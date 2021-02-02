//import { Envelop }       from './Test';
import * as Component    from './Component';
import { handler }       from './CommandHandlers';
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
    this.states.set('empty', {});
  }

  public mockQuery() {

  }
}

export class TestChain extends Component.Component {
  protected parent:        Testers;
  protected handler:       handler;
  protected emittedEvents: Array<Event>;

  constructor(context: Testers, handler: handler) {
    super(<any>context);
    this.parent = context;
    this.handler = handler;
  }

  public with(predefinedStateName: string, predefinedCommandName: string) {
    debugger;
    if (this.emittedEvents != null) throw new Error('Create a new test to do that');
    this.emittedEvents = [];
    const state = this.parent.states.get(predefinedStateName);
    this.handler
    ( state
    , this.parent.commands.get(predefinedCommandName)
    , (type, data, meta) => {
        if (type instanceof Event) {
          this.emittedEvents.push(type);
        } else {
          const version = state.revision + this.emittedEvents.length + 1;
          this.emittedEvents.push(new Event(this.parent.name, state.stateId, version, type.name, data, meta));
        }
      }
    );
    return this;
  }

  public yields(eventType: Typer, predefinedEventName: string | Event) {
    debugger;
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
      this.logger.error('exected emit not happend %s', JSON.stringify(expectedEvent || predefinedEventName));
    }
    return this;
  }

  public verify() {
    debugger;
    if (this.emittedEvents.length > 0) {
      this.logger.error('emit not expected: \n%s', this.emittedEvents.map(ev => JSON.stringify(ev)).join('\n'));
    }
  }
}

