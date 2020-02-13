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

export interface CommandBuses  { [name: string]: CommandBus };
export interface EventBuses    { [name: string]: EventBus };
export interface EventHandlers { [name: string]: eventHandler };
export interface Subscription  { abort: () => Promise<void> };
export interface HookInfo      { category: string; streamId: string; };

export interface EventEmitter extends events.EventEmitter {
  clear(): void;
}

export interface props extends Connected.props {
  commandBuses?:  CommandBuses;
  eventBuses?:    EventBuses;
  eventHandlers?: EventHandlers;
}

const noop = () => {};

export class Service extends Connected.Connected {
  protected commandBuses:  CommandBuses;
  protected eventBuses:    EventBuses;
  protected eventHandlers: EventHandlers;
  protected commandTypes:  { [set: string]: { [name: string]: Typer } };
  protected subscriptions: Array<Subscription>;
  protected callbacks:     ExpireMap<string, { hook: hook, info: HookInfo }>;

  constructor(props: props) {
    super(props);
    this.commandBuses  = props.commandBuses  || {};
    this.eventBuses    = props.eventBuses    || {};
    this.eventHandlers = props.eventHandlers || {};
    this.commandTypes  = {};
    this.subscriptions = [];
    this.callbacks     = new ExpireMap();
    this.callbacks.on('expired', ({ value: { hook } }) => hook(new Error('Timed out')));

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

  public start(): Promise<void> {
    const superPromise = super.start();
    const eSubscriptions = Object.keys(this.eventBuses).map(name => {
      const subscription = [this.name, this.constructor.name].join('.') + ':' + name;
      return this.eventBuses[name].psubscribe(subscription, (event: Event) => {
        return this.handleServiceEvent(event)
      });
    });
    const cChannels = Object.values(this.commandBuses).map(bus => <any>bus.start());
    return <any> Promise.all([superPromise, ...eSubscriptions, ...cChannels]);
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

  protected command(target: string, streamId: string, data: any, meta?: any): EventEmitter {
    const ee = <EventEmitter>new events.EventEmitter();
    ee.on('error', error => this.logger.warn(error.toString()));
    ee.clear = noop;
    setImmediate(() => {
      const [context, category, order] = target.split(':');
      if (!(category in this.commandBuses)) {
        ee.emit('error', new Error('Manager ' + target + ' not found'));
      } else {
        const typer = this.getCommandTyper(context, category, order);
        if (typer) try { typer.from(data); } catch (e) { return ee.emit('error', e); }
        if (meta == null) meta = {};
        if (meta.transactionId == null) meta.transactionId = genId();
        const transactionId = meta.transactionId;
        if (!(meta.ttl > 0)) meta.ttl = 10000;
        const hook = (err: Error, event: Event) => {
          if (err) return ee.emit('error', err);
          ee.removeAllListeners('error').on('error', () => {});
          return ee.emit(event.type, event.data, event);
        };
        this.callbacks.set(meta.transactionId, meta.ttl, { hook, info: { category, streamId } });
        ee.clear = () => this.callbacks.delete(transactionId);
        ee.on('error', () => ee.clear());
        this.commandBuses[category].send(streamId, order, data, meta)
          .then(() => ee.emit('sent', ee))
          .catch(error => ee.emit('error', error));
      }
    });
    return ee;
  }

  public getCommandTyper(context: string, category: string, order: string) {
    const key = context + ':' + category;
    if (key in this.commandTypes) {
      return this.commandTypes[key][order];
    } else {
      const types = this.process.getTypes(context, category, 'commands');
      this.commandTypes[key] = types;
      return types[order];
    }
  }

  public stop(): Promise<void> {
    return <any> Promise.all(this.subscriptions.map(subscription => subscription.abort()));
  }

}
