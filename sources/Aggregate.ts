import * as Component       from './Component';
import { Repository }       from './Repository';
import { CommandBus }       from './CommandBus';
import * as Command         from './CommandHandlers';
import { ConcurencyError }  from './CommandBus';
import { EventBus }         from './EventBus';
import { Command as C }     from './Command';
import { Event   as E }     from './Event';
import { EventNumber }      from './Event';
import { State   as S }     from './State';
import { isType, Typer }    from 'cqes-type';

export { Command };

export type emitter = Command.emitter;

export interface CommandBuses    { [name: string]: CommandBus };
export interface Subscription    { abort: () => Promise<void> };

const defer = typeof queueMicrotask === 'function' ? queueMicrotask
  : typeof process.nextTick === 'function' ? process.nextTick
  : typeof setImmediate === 'function' ? setImmediate
  : (fn: Function) => setTimeout(fn, 1);

export interface props extends Component.props {
  commandBuses?:    CommandBuses;
  repository?:      Repository;
  commandHandlers?: Command.Handlers;
  eventBus?:        EventBus;
}

export class Aggregate extends Component.Component {
  protected commandBuses:    CommandBuses;
  protected repository:      Repository;
  protected commandHandlers: Command.Handlers;
  protected eventBus:        EventBus;
  //
  protected subscriptions:   Array<Subscription>;
  protected queues:          Map<string, Array<() => void>>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.commandHandlers instanceof Command.Handlers)) throw new Error('Bad Command Handlers');
    super({ type: 'Aggregate', ...props });
    this.commandBuses    = props.commandBuses;
    this.repository      = props.repository;
    this.commandHandlers = props.commandHandlers;
    this.eventBus        = props.eventBus;
    this.subscriptions   = [];
    this.queues          = new Map();
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await this.eventBus.start();
    await this.repository.start();
    await this.commandHandlers.start();
    this.subscriptions = await Promise.all(Object.values(this.commandBuses).map(async bus => {
      await bus.start();
      return bus.listen((command: C) => this.handleAggregateCommand(command))
    }));
  }

  protected lock(key: string): Promise<void> {
    const queue = this.queues.get(key);
    if (queue != null) return new Promise(resolve => queue.push(resolve));
    this.queues.set(key, []);
    return Promise.resolve();
  }

  protected getCommandHandler(command: C): Command.handler {
    const fullname = command.category + '_' + command.order;
    if (fullname in this.commandHandlers) return (<any>this.commandHandlers)[fullname];
    const shortname = command.order;
    if (shortname in this.commandHandlers) return (<any>this.commandHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.commandHandlers) return (<any>this.commandHandlers)[wildname];
    return function UnhandledCommand(state: S, command: C) {
      this.logger.warn('Command %s from %s has been lost', command.category, command.order);
    };
  }

  protected async handleAggregateCommand(command: C): Promise<void> {
    const streamId = command.streamId;
    await this.lock(streamId);
    try {
      this.logger.log('%red %s %s', command.order, streamId, command.data);
      const state = await this.repository.get(streamId);
      const events = await this.handleCommand(state, command);
      this.alignEvents(events, state.revision);
      try {
        await this.eventBus.emitEvents(events);
      } catch (e) {
        this.repository.expire(streamId);
        throw new ConcurencyError(e);
      }
    } finally {
      defer(() => this.unlock(streamId));
    }
  }

  protected async handleCommand(state: S, command: C): Promise<Array<E>> {
    const { category, streamId, order } = command;
    const handler = this.getCommandHandler(command);
    const events  = <Array<E>> [];
    const emitter = (type: string | Typer | E, data?: any, customMeta?: any) => {
      const meta = { ...command.meta, ...customMeta };
      if (meta.createdAt) {
        meta.createdAt = null;
        meta.requestedAt = command.meta.createdAt;
      }
      if (type instanceof E) {
        events.push(type);
      } else if (isType(type)) {
        type.from(data);
        events.push(new E(category, streamId, EventNumber.Append, type.name, data, meta));
      } else {
        throw new Error('Deprecated');
      }
    };
    try {
      const returned = await handler.call(this.commandHandlers, state, command, emitter);
      if (returned != null) {
        this.logger.warn('DEPRECATED: Using old command handlers API, use emit instead of returning events');
        const returnedEvents = returned;
        if (returnedEvents instanceof Array) Array.prototype.push.apply(events, returnedEvents);
        else if (returnedEvents instanceof E) events.push(returnedEvents);
      }
    } catch (e) {
      const meta  = { ...command.meta, stack: e.stack };
      const data  = { type: e.name, message: e.toString() };
      const event = new E(category, streamId, EventNumber.Error, 'Error', data, meta).volatil();
      this.logger.error('%grey %s-%s %s', 'Error:' + order, category, streamId, command.data);
      this.logger.error(e);
      return [event];
    }
    if (events.length === 0) {
      const meta  = { ...command.meta, command: { category, order } };
      const event = new E(category, streamId, EventNumber.NoOp, 'NoOp', command.data, meta).volatil();
      this.logger.log('%grey %s-%s %s', 'NoOp:' + order, category, streamId, command.data);
      return [event];
    } else {
      return events;
    }
  }

  protected alignEvents(events: Array<E>, version: number) {
    for (let i = 0, offset = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event.meta == null) event.meta = {};
      if (event.meta.createdAt == null) event.meta.createdAt = new Date().toISOString();
      if (event.meta.$persistent === false) continue ;
      if (event.number == null) event.number = version + offset + 1;
      if (event.number === EventNumber.Append) event.number = version + offset + 1;
      else if (event.number !== version + offset + 1) throw new Error('Event can not be aligned');
      offset += 1;
    }
  }

  protected unlock(key: string): void {
    const queue = this.queues.get(key);
    if (queue.length > 0) setImmediate(queue.shift());
    else if (queue.length === 0) this.queues.delete(key);
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(this.subscriptions.map(subscription => subscription.abort()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await this.commandHandlers.stop();
    await this.repository.stop();
    await this.eventBus.stop();
    await super.stop();
  }

}
