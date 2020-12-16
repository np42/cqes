import * as Component                from './Component';
import { EventBus, Subscription }    from './EventBus';
import { EventHandling }             from './EventBus';
import { StateBus }                  from './StateBus';
import * as React                    from './ReactHandlers';
import { State }                     from './State';
import { Event }                     from './Event';
const  CachingMap                    = require('caching-map');

export { React };

export interface EventBuses { [name: string]: EventBus }

export interface props extends Component.props {
  eventBuses?:     EventBuses;
  triggerHandlers: React.Handlers;
  stateBus?:       StateBus;
  partition?:      (event: Event) => string;
  cacheSize?:      number;
}

export class Trigger extends Component.Component {
  protected eventBuses:      EventBuses;
  protected triggerHandlers: React.Handlers;
  protected stateBus:        StateBus;
  //
  protected subscriptions: Array<Subscription>;
  protected cache:         Map<string, State>;
  protected partition:     (event: Event) => string;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.triggerHandlers instanceof React.Handlers)) throw new Error('Bad Trigger Handlers');
    super({ type: 'Trigger', ...props });
    this.eventBuses      = props.eventBuses;
    this.triggerHandlers = props.triggerHandlers;
    this.stateBus        = props.stateBus;
    this.partition       = props.partition || ((event: Event) => 'main');
    this.cache           = new CachingMap({ size: props.cacheSize || 1000 });
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await this.stateBus.start()
    await this.triggerHandlers.start();
    this.subscriptions = await Promise.all(Object.values(this.eventBuses).map(async bus => {
      await bus.start();
      const subscription = [this.fqn, bus.category].join(':');
      return bus.psubscribe(subscription, event => this.handleTriggerEvent(event));
    }));
  }

  protected getTriggerHandler(event: Event) {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.triggerHandlers) return (<any>this.triggerHandlers)[fullname];
    const shortname = event.type;
    if (shortname in this.triggerHandlers) return (<any>this.triggerHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.triggerHandlers) return (<any>this.triggerHandlers)[wildname];
    return (state: State, event: Event) => state;
  }

  protected async getState(stateId: string) {
    const cached = this.cache.get(stateId);
    if (cached) return cached;
    return await this.stateBus.get(stateId);
  }

  protected async handleTriggerEvent(event: Event): Promise<EventHandling> {
    const handler  = this.getTriggerHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%magenta %s@%s-%s %j', handler.name, number, category, streamId, data);
      const stateId  = this.partition(event);
      const state    = await this.getState(stateId);
      const newState = await handler.call(this.triggerHandlers, state, event);
      //if (newState != null) this.setState(stateId, newState);
      return EventHandling.Handled;
    } else {
      return EventHandling.Ignored;
    }
  }

  protected setState(stateId: string, state: State) {
    state.stateId = stateId;
    this.cache.set(stateId, state);
    this.stateBus.set(state);
  }

  public async stop() {
    if (!this.started) return ;
    await Promise.all(Object.values(this.subscriptions).map(sub => sub.abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    await this.triggerHandlers.stop();
    await this.stateBus.stop();
    await super.stop();
  }

}
