import * as Component   from './Component';
import { CommandBus }   from './CommandBus';
import { EventBus }     from './EventBus';
import { QueryBus }     from './QueryBus';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { ExpireMap }    from './util';
import { EventEmitter } from 'events';
import { v1 as uuid }   from 'uuid';

export type sender = (name: string, id: string, order: string, data: any, meta?: any) => Promise<void>;
export type eventHandler = (event: Event, send: sender) => Promise<void>;
export type hook = (err: Error, event?: Event) => void;

export interface CommandBuses  { [name: string]: CommandBus };
export interface EventBuses    { [name: string]: EventBus };
export interface QueryBuses    { [name: string]: QueryBus };
export interface EventHandlers { [name: string]: eventHandler };
export interface Subscription  { abort: () => Promise<void> };
export interface HookInfo      { category: string; streamId: string; };

export interface props extends Component.props {
  commandBuses?:  CommandBuses;
  eventBuses?:    EventBuses;
  eventHandlers?: EventHandlers;
  queryBuses?:    QueryBuses;
}

export class Service extends Component.Component {
  protected commandBuses:  CommandBuses;
  protected eventBuses:    EventBuses;
  protected queryBuses:    QueryBuses;
  protected eventHandlers: EventHandlers;
  protected subscriptions: Array<Subscription>;
  protected callbacks:     ExpireMap<string, { hook: hook, info: HookInfo }>;

  constructor(props: props) {
    super(props);
    this.commandBuses  = props.commandBuses  || {};
    this.eventBuses    = props.eventBuses    || {};
    this.queryBuses    = props.queryBuses    || {};
    this.eventHandlers = props.eventHandlers || {};
    this.subscriptions = [];
    this.callbacks     = new ExpireMap();
    this.callbacks.on('expired', ({ value: { hook } }) => hook(new Error('Timed out')));
  }

  public start(): Promise<void> {
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
    const eSubscriptions = Object.keys(this.eventBuses).map(name => {
      const subscription = [this.name, this.constructor.name].join('.') + ':' + name;
      return this.eventBuses[name].psubscribe(subscription, (event: Event) => {
        return this.handleServiceEvent(event)
      });
    });
    const cChannels = Object.values(this.commandBuses).map(bus => <any>bus.start());
    return <any> Promise.all([eSubscriptions, ...cChannels]);
  }

  protected async handleServiceEvent(event: Event): Promise<void> {
    const sender = (name: string, id: string, order: string, data: any, meta?: any) => {
      return this.commandBuses[name].send(id, order, data, meta);
    };
    const handler = this.getEventHandler(event);
    if (handler != null) {
      this.logger.log('%green %s-%s %j', handler.name, event.category, event.streamId, event.data);
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

  protected query(target: string, data: any, meta?: any): EventEmitter {
    const ee     = new EventEmitter();
    const offset = target.indexOf('.');
    const view   = target.substring(0, offset);
    const method = target.substring(offset + 1);
    if (!(view in this.queryBuses)) {
      setImmediate(() => ee.emit('error', new Error('View ' + view + ' not found')));
      return ee;
    }
    this.queryBuses[view].request(method, data, meta)
      .catch((error: Error) => ee.emit('error', error))
      .then((reply: Reply) => ee.emit(reply.type, reply.data))
    return ee;
  }

  protected command(target: string, streamId: string, data: any, meta?: any): EventEmitter {
    const ee       = new EventEmitter();
    const offset   = target.indexOf('.');
    const category = target.substring(0, offset);
    const order    = target.substring(offset + 1);
    if (!(category in this.queryBuses)) {
      setImmediate(() => ee.emit('error', new Error('Manager ' + category + ' not found')));
      return ee;
    }
    if (meta == null) meta = {};
    if (meta.transactionId == null) meta.transactionId = uuid();
    if (!(meta.ttl > 0)) meta.ttl = 10000;
    const hook = (err: Error, event: Event) => err ? ee.emit('error', err) : ee.emit(event.type, event);
    this.callbacks.set(meta.transactionId, meta.ttl, { hook, info: { category, streamId } });
    this.commandBuses[category].send(streamId, order, data, meta)
      .catch(error => ee.emit('error', error))
    return ee;
  }

  public stop(): Promise<void> {
    return <any> Promise.all(this.subscriptions.map(subscription => subscription.abort()));
  }

}
