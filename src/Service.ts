import * as Component       from './Component';
import * as Event           from './EventHandlers';
import * as CommandAble     from './CommandAble';
import * as QueryAble       from './QueryAble';
import { EventBus }         from './EventBus';
import { Event as E }       from './Event';
import { ExpireMap, genId } from 'cqes-util';
import { Typer }            from 'cqes-type';
import * as events          from 'events';

export { Event };

export type eventHandler = (event: E) => Promise<void>;
//export type hook = (err: Error, event?: E) => void;

export interface EventBuses    { [name: string]: EventBus };
export interface Subscription  { abort: () => Promise<void> };
//export interface HookInfo      { category: string; streamId: string; ee: CommandEventEmitter };
/*
export interface CommandEventEmitter extends events.EventEmitter {
  clear(): void;
}
*/
export interface props extends Component.props, QueryAble.props, CommandAble.props {
  eventBuses?:    EventBuses;
  eventHandlers?: Event.Handlers;
  subscriptions?: Array<string>;
}

//const noop = () => {};

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
  //
  protected subscriptions: Array<string | Subscription>;
  //protected callbacks:     ExpireMap<string, { hook: hook, info: HookInfo }>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.eventHandlers instanceof Event.Handlers)) throw new Error('Bad Event Handlers');
    super({ type: 'Service', ...props });
    CommandAble.extend(this, props);
    QueryAble.extend(this, props);
    this.eventBuses    = props.eventBuses;
    this.eventHandlers = props.eventHandlers;
    this.subscriptions = props.subscriptions;
    /*
    this.callbacks     = new ExpireMap();
    this.callbacks.on('expired', ({ value: { hook, info: { ee } } }) => {
      hook(new Error('Timed out'))
    });
    let lastTransactionId = <string>null;
    this.eventHandlers.any = (event: E) => {
      const transactionId = (event.meta || {}).transactionId;
      if (transactionId == null) return Promise.resolve();
      const callback = this.callbacks.get(transactionId);
      if (callback == null) return Promise.resolve();
      callback.hook(null, event);
      if (lastTransactionId && lastTransactionId != transactionId)
        this.callbacks.delete(lastTransactionId);
      lastTransactionId = transactionId;
      return Promise.resolve();
    };
    */
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

  protected getEventHandler(event: E): eventHandler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.eventHandlers) return this.eventHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.eventHandlers) return this.eventHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.eventHandlers) return this.eventHandlers[wildname];
  }

  protected async handleServiceEvent(event: E): Promise<void> {
    const handler = this.getEventHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%green %s@%s-%s %j', handler.name, number, category, streamId, data);
      return handler.call(this.eventHandlers, event);
    }
  }

/*
  protected command(target: string, streamId: string, data: any, meta?: any) {
    const [context, category, order] = target.split(':');
    if (meta == null) meta = {};
    if (meta.transactionId == null) meta.transactionId = genId();
    const transactionId = meta.transactionId;
    if (!(meta.ttl > 0)) meta.ttl = 10000;
    const ee = <CommandEventEmitter>super.command(target, streamId, data, meta);
    const hook = (err: Error, event: E) => {
      if (err) return ee.emit('error', err);
      ee.removeAllListeners('error').on('error', () => {});
      return ee.emit(event.type, event.data, event);
    };
    this.callbacks.set(meta.transactionId, meta.ttl, { hook, info: { category, streamId, ee } });
    ee.clear = () => this.callbacks.delete(transactionId);
    ee.on('sent', () => {
      const events = ee.eventNames();
      events.splice(events.indexOf('error'), 1);
      events.splice(events.indexOf('sent'), 1);
      if (events.length === 0) ee.clear();
    });
    ee.on('error', () => ee.clear());
    return ee;
  }
*/
  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(this.subscriptions.map(sub => (<any>sub).abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    await this.eventHandlers.stop();
    await super.stop();
  }

}
