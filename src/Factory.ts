import * as Component  from './Component';

import { Queue }       from './Queue';

import { event as E }  from './event';
import { state as S }  from './state';

export interface props extends Component.props {
  state?:  { new (data: any): any };
  events?: { [name: string]: { new (data: any): any } };
}

type events = Array<E>;

export class Factory extends Component.Component {
  protected state:   { new (data: any): any };
  protected events:  { [name: string]: { new (data: any): any } };
  protected states:  Map<string, S>;
  protected queue:   Queue;

  constructor(props: props) {
    super(props);
    this.state   = props.state  || Object;
    this.events  = props.events || {};
    this.states  = new Map();
    this.queue   = new Queue();
  }

  public async start(): Promise<boolean> {
    this.bus.event.subscribe(this.module, async (id: string, revision: number, events: events) => {
      const curState = this.states.get(id) || this.create(id);
      const newState = events.reduce((state, event) => {
        const type = this.events[event.name];
        if (type == null) {
          this.logger.error('No type for %j', event);
          throw new Error('Event type is missing');
        } else {
          event.data = new type(event.data);
          return this.apply(state, event)
        }
      }, curState);
      this.states.set(id, newState);
    }, 0).then(() => {
      this.queue.resume();
    });
    return true;
  }

  /**************************/

  public create(id: string) {
    return new S(this.module, id, -1, new this.state({ ID: id }));
  }

  public get(id: string): Promise<S> {
    if (this.queue.running) {
      return Promise.resolve(this.states.get(id) || this.create(id));
    } else {
      return this.queue.push(this, this.get, id);
    }
  }

  public apply(state: S, event: E) {
    const revision = state.revision;
    const applier = this['apply' + event.name];
    let newState = state;
    if (applier) {
      this.logger.log('%s apply %s: %j', state.key, event.name, event.data);
      newState = applier.call(this, state, event) || state;
    } else {
      this.logger.warn('%s skip %s: %j', state.key, event.name, event.data);
    }
    newState.revision = state.revision + 1;
    return newState;
  }

}
