import * as Component                from './Component';
import { Handlers as EventHandlers
       , handler  as eventHandler
       }                             from './EventHandlers';
import { Handlers as CommandHandlers
       , handler  as commandHandler
       }                             from './CommandHandlers';
import * as CommandAble              from './CommandAble';
import * as RpcAble                  from './RpcAble';
import * as StateAble                from './StateAble';
import { AsyncCall }                 from './AsyncCall';
import { EventBus, EventHandling }   from './EventBus';
import { Event as E }                from './Event';
import { State as S }                from './State';
import { ExpireMap, genId }          from 'cqes-util';
import { Typer }                     from 'cqes-type';

export namespace Event {
  export class Handlers extends EventHandlers {
    protected runtime: any;
  }
}

export namespace Command {
  export class Handlers extends CommandHandlers {
    protected runtime: any;
  }
}

export interface EventBuses     { [name: string]: EventBus };
export interface Subscription   { abort: () => Promise<void> };
export interface Constructor<T> { new (...a: Array<any>): T };
export interface props extends Component.props, RpcAble.props, CommandAble.props, StateAble.props {
  eventHandlers:   Event.Handlers;
  eventBuses:      EventBuses;
  psubscriptions:  Array<string>;
  subscriptions:   Array<string>;
}

export class Service extends Component.Component {
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected command:         (target: Typer, streamId: string, data: any, meta?: any) => AsyncCall;
  // About Query
  protected rpcBuses:      RpcAble.Buses;
  protected query:         (target: Typer, data: any, meta?: any) => AsyncCall;
  protected request:       (target: Typer, data: any, meta?: any) => AsyncCall;
  // About Event
  protected eventBuses:    EventBuses;
  protected eventHandlers: Event.Handlers;
  // About State
  protected repositories:  StateAble.Repositories;
  protected get:           <X>(type: Constructor<X>, streamId: string, minRevision?: number) => Promise<S<X>>;
  //
  protected psubscriptions: Array<string | Subscription>;
  protected subscriptions:  Array<string | Subscription>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    super({ type: 'Service', ...props });
    CommandAble.extend(this, props);
    RpcAble.extend(this, props);
    StateAble.extend(this, props);
    this.eventHandlers  = props.eventHandlers  || null;
    this.eventBuses     = props.eventBuses     || {};
    this.psubscriptions = props.psubscriptions || [];
    this.subscriptions  = props.subscriptions  || [];
    if (this.eventHandlers != null && this.eventHandlers['runtime'] == null) {
      Object.defineProperty(this.eventHandlers, 'runtime', { value: this });
    }
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.start()));
    if (this.eventHandlers != null) await this.eventHandlers.start();
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.repositories).map(repository => repository.start()));
    this.psubscriptions = await Promise.all(this.psubscriptions.map((name: string) => {
      if (typeof name != 'string') return Promise.resolve(null);
      const bus = this.eventBuses[name];
      const subscription = [this.fqn, bus.category].join(':');
      return bus.psubscribe(subscription, event => this.handleServiceEvent(event));
    }));
    this.subscriptions = await Promise.all(this.subscriptions.map((name: string) => {
      if (typeof name != 'string') return Promise.resolve(null);
      const bus = this.eventBuses[name];
      return bus.subscribe(async event => { await this.handleServiceEvent(event); });
    }));
  }

  protected getEventHandler(event: E): eventHandler {
    if (this.eventHandlers == null) return ev => new Promise(resolve => resolve());
    const fullname = event.category + '_' + event.type;
    if (fullname in this.eventHandlers) return (<any>this.eventHandlers)[fullname];
    const shortname = event.type;
    if (shortname in this.eventHandlers) return (<any>this.eventHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.eventHandlers) return (<any>this.eventHandlers)[wildname];
  }

  protected async handleServiceEvent(event: E): Promise<EventHandling> {
    const handler = this.getEventHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%green %s@%s-%s %s', handler.name, number, category, streamId, data);
      await handler.call(this.eventHandlers, event);
      return EventHandling.Handled;
    } else {
      return EventHandling.Ignored;
    }
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.repositories).map(repository => repository.stop()));
    await Promise.all(this.psubscriptions.map(sub => (<any>sub).abort()));
    await Promise.all(this.subscriptions.map(sub => (<any>sub).abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    if (this.eventHandlers != null) await this.eventHandlers.stop();
    await super.stop();
  }

}
