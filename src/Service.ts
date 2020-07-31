import * as Component       from './Component';
import * as Event           from './EventHandlers';
import * as CommandAble     from './CommandAble';
import * as QueryAble       from './QueryAble';
import * as StateAble       from './StateAble';
import { EventBus }         from './EventBus';
import { Event as E }       from './Event';
import { State as S }       from './State';
import { ExpireMap, genId } from 'cqes-util';
import { Typer }            from 'cqes-type';

export { Event };

export interface EventBuses    { [name: string]: EventBus };
export interface Subscription  { abort: () => Promise<void> };
export interface props extends Component.props, QueryAble.props, CommandAble.props, StateAble.props {
  eventHandlers:   Event.Handlers;
  eventBuses:      EventBuses;
  subscriptions:   Array<string>;
}

export class Service extends Component.Component {
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected commandTypes:    CommandAble.Types;
  protected command:         (target: string, streamId: string, data: any, meta?: any) => CommandAble.EventEmitter;
  protected getCommandTyper: (context: string, category: string, order: string) => Typer;
  // About Query
  protected queryBuses:    QueryAble.Buses;
  protected queryTypes:    QueryAble.Types;
  protected query:         (target: string, data: any, meta?: any) => QueryAble.EventEmitter;
  protected getQueryTyper: (context: string, view: string, method: string) => Typer;
  // About Event
  protected eventBuses:    EventBuses;
  protected eventHandlers: Event.Handlers;
  // About State
  protected repositories:  StateAble.Repositories;
  protected get:           <X>(type: { new (...a: Array<any>): X }, streamId: string) => Promise<S<X>>;
  //
  protected subscriptions: Array<string | Subscription>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.eventHandlers instanceof Event.Handlers)) throw new Error('Bad Event Handlers');
    super({ type: 'Service', ...props });
    CommandAble.extend(this, props);
    QueryAble.extend(this, props);
    StateAble.extend(this, props);
    this.eventBuses    = props.eventBuses;
    this.eventHandlers = props.eventHandlers;
    this.subscriptions = props.subscriptions;
    if (this.eventHandlers.service == null) this.eventHandlers.service = this;
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.start()));
    await this.eventHandlers.start();
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.start()));
    this.subscriptions = await Promise.all(this.subscriptions.map((name: string) => {
      if (typeof name != 'string') return Promise.resolve(null);
      const bus = this.eventBuses[name];
      const subscription = [this.fqn, bus.category].join(':');
      return bus.psubscribe(subscription, event => this.handleServiceEvent(event));
    }));
  }

  protected getEventHandler(event: E): Event.handler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.eventHandlers) return (<any>this.eventHandlers)[fullname];
    const shortname = event.type;
    if (shortname in this.eventHandlers) return (<any>this.eventHandlers)[shortname];
    const wildname = 'any';
    if (wildname in this.eventHandlers) return (<any>this.eventHandlers)[wildname];
  }

  protected async handleServiceEvent(event: E): Promise<void> {
    const handler = this.getEventHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%green %s@%s-%s %j', handler.name, number, category, streamId, data);
      return handler.call(this.eventHandlers, event);
    }
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(this.subscriptions.map(sub => (<any>sub).abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    await this.eventHandlers.stop();
    await super.stop();
  }

}
