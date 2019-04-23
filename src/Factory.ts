import * as Component  from './Component';

import * as Bus        from './Bus';
import { Queue }       from './Queue';

import { event }       from './event';
import { state }       from './state';

export interface props extends Component.props {
  bus: Bus.Bus
}

export interface children extends Component.children {}

type events = Array<event<any>>;

export class Factory extends Component.Component {
  protected bus:     Bus.Bus;
  protected states:  Map<string, state<any>>;
  protected queue:   Queue;
  protected ready:   boolean;

  constructor(props: props, children: children) {
    super({ ...props, type: 'factory', color: 'green' }, children);
    this.bus     = props.bus;
    this.states  = new Map();
    this.queue   = new Queue();
  }

  public async start(): Promise<boolean> {
    await this.bus.event.subscribe(this.context, async (id: string, revision: number, events: events) => {
      const state = await this.get(id);
      const newState = events.reduce((state, event) => this.apply(state, event), state);
      this.states.set(id, state);
    }, 0);
    this.queue.resume();
    return true;
  }

  public get(id: string): Promise<state<any>> {
    if (this.queue.running) {
      return Promise.resolve(this.states.get(id));
    } else {
      return this.queue.push(this, this.get, id);
    }
  }

  public apply(state: state<any>, event: event<any>) {
    const revision = state.revision;
    const method = 'apply' + event.name;
    const applier = this.getEventApplier(method, event);
    let newState = state;
    if (applier) {
      this.logger.log('%s apply %s: %j', state.key, event.name, event.data);
      newState = applier.call(this, state, event) || state;
    } else {
      this.logger.warn('%s skip %s: %j', state.key, event.name, event.data);
    }
    if (newState.revision >= 0) {
      const diff = newState.revision - revision;
      if (diff === 0) {
        this.logger.debug('State %s@%s not changed', newState.revision, newState.key);
      } else {
        this.logger.debug('State %s@%s changed +%s', newState.revision, newState.key, diff);
      }
    } else {
      this.logger.debug('State %s destroyed', newState.key);
    }
    return newState;
  }

  protected getEventApplier(name: string, event: event<any>) {
    return this[name];
  }

}
