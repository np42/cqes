//import { Envelop }       from './Test';
import * as Component    from './Component';
import { handler }       from './QueryHandlers';
import { Query }         from './Query';
import { Typer }         from 'cqes-type';
import * as assert       from 'assert';

export interface props extends Component.props {

}

export class Testers extends Component.Component {
  public queries: Map<string, any>;

  constructor(props: props) {
    super(props)
    this.queries   = new Map();
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

  public execWith(predefinedQueryName: string) {
    /*
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
    */
    return this;
  }

  public returns(eventType: Typer, predefinedPatternName: string | Query) {
    /*
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
    */
    return this;
  }

  public verify() {
    /*
    if (this.emittedEvents.length > 0) {
      this.logger.error('Emit unexpected: \n%s', this.emittedEvents.map(ev => JSON.stringify(ev)).join('\n'));
    } else {
      this.logger.log('%green', '√');
    }
    */
  }
}

