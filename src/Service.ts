import * as Connected       from './Connected';
import { CommandBus }       from './CommandBus';
import { EventBus }         from './EventBus';
import { Event }            from './Event';
import { ExpireMap, genId } from 'cqes-util';
import { Typer }            from 'cqes-type';
import * as events          from 'events';

export type sender = (name: string, id: string, order: string, data: any, meta?: any) => Promise<void>;
export type eventHandler = (event: Event, send: sender) => Promise<void>;
export type hook = (err: Error, event?: Event) => void;

export interface EventBuses    { [name: string]: EventBus };
export interface EventHandlers { [name: string]: eventHandler };
export interface Subscription  { abort: () => Promise<void> };
export interface HookInfo      { category: string; streamId: string; ee: CommandEventEmitter };

export interface CommandEventEmitter extends events.EventEmitter {
  clear(): void;
}

export interface props extends Connected.props {
  eventBuses?:    EventBuses;
  subscriptions?: Array<string>;
  eventHandlers?: EventHandlers;
}

const noop = () => {};

export class Service extends Connected.Connected {
  protected eventBuses:    EventBuses;
  protected eventHandlers: EventHandlers;
  protected subscriptions: Array<string | Subscription>;
  protected callbacks:     ExpireMap<string, { hook: hook, info: HookInfo }>;

  constructor(props: props) {
    super(props);
    this.eventBuses    = props.eventBuses    || {};
    this.eventHandlers = props.eventHandlers || {};
    this.subscriptions = props.subscriptions || [];
    this.callbacks     = new ExpireMap();
    this.callbacks.on('expired', ({ value: { hook, info: { ee } } }) => {
      hook(new Error('Timed out'))
    });

    let lastTransactionId = <string>null;
    this.eventHandlers.any = (event: Event) => {
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
  }

  public async start(): Promise<void> {
    const superPromise   = await super.start();
    const eSubscriptions = this.subscriptions.map((name: string) => {
      if (typeof name != 'string') return Promise.resolve(null);
      const subscription = [this.name, this.constructor.name].join('.') + ':' + name;
      return this.eventBuses[name].psubscribe(subscription, (event: Event) => {
        return this.handleServiceEvent(event)
      });
    });
    return new Promise((resolve, reject) => {
      Promise.all(eSubscriptions).then(result => {
        for (let i = 0; i < result.length; i += 1) {
          if (result[i] != null)
            this.subscriptions[i] = result[i];
        }
        return resolve();
      }).catch(reject);
    });
  }

  protected async handleServiceEvent(event: Event): Promise<void> {
    const sender = (name: string, id: string, order: string, data: any, meta?: any) => {
      return this.commandBuses[name].send(id, order, data, meta);
    };
    const handler = this.getEventHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%green %s@%s-%s %j', handler.name, number, category, streamId, data);
      return handler.call(this.eventHandlers, event, sender);
    }
  }

  protected getEventHandler(event: Event): eventHandler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.eventHandlers) return this.eventHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.eventHandlers) return this.eventHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.eventHandlers) return this.eventHandlers[wildname];
  }

  protected command(target: string, streamId: string, data: any, meta?: any) {
    const [context, category, order] = target.split(':');
    if (meta == null) meta = {};
    if (meta.transactionId == null) meta.transactionId = genId();
    const transactionId = meta.transactionId;
    if (!(meta.ttl > 0)) meta.ttl = 10000;
    const ee = <CommandEventEmitter>super.command(target, streamId, data, meta);
    const hook = (err: Error, event: Event) => {
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

  public stop(): Promise<void> {
    return <any> Promise.all(this.subscriptions.map(subscription => {
      if (typeof subscription != 'string')
        subscription.abort();
    }));
  }

}
