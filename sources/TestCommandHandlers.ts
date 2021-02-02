//import { Envelop }       from './Test';
import * as Component    from './Component';
import { handler }       from './CommandHandlers';
import { Command }       from './Command';
import { State }         from './State';
import { Event }         from './Event';
import { Typer }         from 'cqes-type';
import { v4 as uuid }    from 'uuid';
import * as assert       from 'assert';

export interface props extends Component.props {

}

export class Testers extends Component.Component {
  public states:   Map<string, any>;
  public commands: Map<string, any>;
  public events:   Map<string, any>;

  constructor(props: props) {
    super(props)
    this.states    = new Map();
    this.commands  = new Map();
    this.events    = new Map();
    this.states.set('empty', new State(null, -1, 'Test', {}));
  }

  public mockQuery() {

  }
}

export class TestChain extends Component.Component {
  protected parent:        Testers;
  protected handler:       handler;
  protected emittedEvents: Array<Event>;

  constructor(parent: Testers, handler: handler) {
    super(<any>parent);
    this.parent = parent;
    this.handler = handler;
  }

  public with(predefinedStateName: string, predefinedCommandName: string) {
    if (this.emittedEvents != null) throw new Error('Create a new test to do that');
    this.emittedEvents = [];
    const id = uuid();

    const rawCommand = this.parent.commands.get(predefinedCommandName);
    const command = rawCommand instanceof Command ? rawCommand
      : new Command(this.name, id, this.handler.name, rawCommand);

    const rawState = this.parent.states.get(predefinedStateName);
    const state = (rawState instanceof State ? rawState : new State(id, 0, 'Test', rawState)).clone();
    state.stateId = id;

    this.handler(state, command, (type, data, meta) => {
      if (type instanceof Event) {
        this.emittedEvents.push(type);
      } else {
        const version = state.revision + this.emittedEvents.length + 1;
        this.emittedEvents.push(new Event(this.parent.name, state.stateId, version, type.name, data, meta));
      }
    });
    return this;
  }

  public yields(eventType: Typer, predefinedEventName: string | Event) {
    const expectedEvent = typeof predefinedEventName === 'string' ? this.parent.events.get(predefinedEventName)
      : predefinedEventName;
    const initialLength = this.emittedEvents.length;
    this.emittedEvents = this.emittedEvents.filter(event => {
      try {
        assert.deepEqual(event.data, expectedEvent);
        return false;
      } catch (e) {
        return true;
      }
    });
    if (initialLength === this.emittedEvents.length) {
      this.logger.error('Exected emit not happend %s', JSON.stringify(expectedEvent || predefinedEventName));
    } else {
      this.logger.log('Expected emit happend: %s', eventType.name);
    }
    return this;
  }

  public verify() {
    if (this.emittedEvents.length > 0) {
      this.logger.error('Emit unexpected: \n%s', this.emittedEvents.map(ev => JSON.stringify(ev)).join('\n'));
    } else {
      this.logger.log('%green', '√');
    }
  }
}

