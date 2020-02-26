import * as Component       from './Component';
import { Repository }       from './Repository';
import { CommandBus }       from './CommandBus';
import * as Command         from './CommandHandlers';
import { ConcurencyError }  from './CommandBus';
import { EventBus }         from './EventBus';
import { Command as C }     from './Command';
import { Event   as E }     from './Event';
import { State   as S }     from './State';

export { Command };

export type emitter        = (type: string, data: any, meta?: any) => void
export type commandHandler = (state: S, command: C, emit?: emitter) => Array<E> | E | void;

export interface CommandBuses    { [name: string]: CommandBus };
export interface Subscription    { abort: () => Promise<void> };

export interface props extends Component.props {
  commandBuses?:    CommandBuses;
  repository?:      Repository;
  commandHandlers?: Command.Handlers;
  eventBus?:        EventBus;
}

export class Manager extends Component.Component {
  protected commandBuses:    CommandBuses;
  protected repository:      Repository;
  protected commandHandlers: Command.Handlers;
  protected eventBus:        EventBus;
  //
  protected subscriptions:   Array<Subscription>;
  protected queues:          Map<string, Array<() => void>>;

  constructor(props: props) {
    if (!(props.commandHandlers instanceof Command.Handlers)) throw new Error('Bad Command Handlers');
    super(props);
    this.commandBuses    = props.commandBuses;
    this.repository      = props.repository;
    this.commandHandlers = props.commandHandlers;
    this.eventBus        = props.eventBus;
    this.subscriptions   = [];
    this.queues          = new Map();
  }

  public async start(): Promise<void> {
    await this.eventBus.start();
    await this.repository.start();
    await this.commandHandlers.start();
    this.subscriptions = await Promise.all(Object.values(this.commandBuses).map(async bus => {
      await bus.start();
      return bus.listen((command: C) => this.handleManagerCommand(command))
    }));
  }

  protected lock(key: string): Promise<void> {
    const queue = this.queues.get(key);
    if (queue != null) return new Promise(resolve => queue.push(resolve));
    this.queues.set(key, []);
    return Promise.resolve();
  }

  protected getCommandHandler(command: C) {
    const fullname = command.category + '_' + command.order;
    if (fullname in this.commandHandlers) return this.commandHandlers[fullname];
    const shortname = command.order;
    if (shortname in this.commandHandlers) return this.commandHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.commandHandlers) return this.commandHandlers[wildname];
    return function UnhandledCommand(state: S, command: C) {
      this.logger.warn('Command %s from %s has been lost', command.category, command.order);
    };
  }

  protected async handleManagerCommand(command: C): Promise<void> {
    const stream = command.stream;
    await this.lock(stream);
    try {
      this.logger.log('%red %s %j', command.order, command.streamId, command.data);
      const state = await this.repository.get(stream);
      const events = await this.handleCommand(state, command);
      for (let i = 0; i < events.length; i += 1)
        events[i].number = state.revision + i + 1;
      try {
        await this.eventBus.emitEvents(events);
      } catch (e) {
        this.repository.expire(stream);
        throw new ConcurencyError(e);
      }
    } finally {
      process.nextTick(() => this.unlock(stream));
    }
  }

  protected async handleCommand(state: S, command: C): Promise<Array<E>> {
    const { category, streamId, order } = command;
    const handler = this.getCommandHandler(command);
    const events  = <Array<E>> [];
    const emitter = (type: string | E, data?: any, meta?: any) => {
      if (type instanceof E) events.push(type);
      else events.push(new E(category, streamId, -1, type, data, meta));
    };
    try {
      const returnedEvents = await handler.call(this.commandHandlers, state, command, emitter);
      if (returnedEvents instanceof Array) Array.prototype.push.apply(events, returnedEvents);
      else if (returnedEvents instanceof E) events.push(returnedEvents);
    } catch (e) {
      const meta  = { ...command.meta, persist: false, stack: e.stack };
      const data  = { type: e.name, message: e.toString() };
      const event = new E(category, streamId, -2, 'Error', data, meta);
      this.logger.error('%yellow %s-%s %d', 'Error:' + order, category, streamId, command.data);
      this.logger.error(e);
      return [event];
    }
    if (events.length === 0) {
      const meta  = { ...command.meta, persist: false, command: { category, order } };
      const event = new E(category, streamId, -2, 'NoOp', command.data, meta);
      this.logger.log('%yellow %s-%s %d', 'NoOp:' + order, category, streamId, command.data);
      return [event];
    } else {
      return events;
    }
  }

  protected unlock(key: string): void {
    const queue = this.queues.get(key);
    if (queue.length > 0) setImmediate(queue.shift());
    else if (queue.length === 0) this.queues.delete(key);
  }

  public async stop(): Promise<void> {
    await Promise.all(this.subscriptions.map(subscription => subscription.abort()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await this.commandHandlers.stop();
    await this.repository.stop();
    await this.eventBus.stop();
  }

}
