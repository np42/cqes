import * as Component      from './Component';
import { CommandBus }      from './CommandBus';
import { ConcurencyError } from './CommandBus';
import { EventBus }        from './EventBus';
import { StateBus }        from './StateBus';
import { Command as C }    from './Command';
import { Event   as E }    from './Event';
import { State   as S }    from './State';
import { Typer }           from 'cqes-type';

export type emitter        = (type: string, data: any, meta?: any) => void
export type commandHandler = (state: S, command: C, emit?: emitter) => Array<E> | E | void;
export type domainHandler  = (state: S, event: E) => S;

export interface Events          { [name: string]: Typer };
export interface CommandHandlers { [name: string]: commandHandler };
export interface CommandBuses    { [name: string]: CommandBus };
export interface DomainHandlers  { [name: string]: domainHandler };
export interface Subscription    { abort: () => Promise<void> };

export interface props extends Component.props {
  commandBuses?:    CommandBuses;
  stateBus?:        StateBus;
  eventBus?:        EventBus;
  commandHandlers?: CommandHandlers;
  domainHandlers?:  DomainHandlers;
  events?:          Events;
}

export class Manager extends Component.Component {
  protected commandBuses:    CommandBuses;
  protected stateBus:        StateBus;
  protected eventBus:        EventBus;
  protected commandHandlers: CommandHandlers;
  protected domainHandlers:  DomainHandlers;
  protected events:          Events;
  protected subscriptions:   Array<Subscription>;
  protected queues:          Map<string, Array<() => void>>;

  constructor(props: props) {
    super(props);
    this.commandBuses    = props.commandBuses    || {};
    this.eventBus        = props.eventBus;
    this.stateBus        = props.stateBus;
    this.commandHandlers = props.commandHandlers || {};
    this.domainHandlers  = props.domainHandlers  || {};
    this.events          = props.events          || {};
    this.subscriptions   = [];
    this.queues          = new Map();
  }

  public async start(): Promise<void> {
    await this.eventBus.start();
    await this.stateBus.start();
    await Promise.all(Object.values(this.commandBuses).map(async bus => {
      await bus.start();
      await bus.listen((command: C) => this.handleManagerCommand(command))
    }));
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
    const stateId = command.stream;
    await this.lock(stateId);
    try {
      this.logger.log('%red %s %j', command.order, command.streamId, command.data);
      const state = await this.getState(stateId);
      const events = await this.handleCommand(state, command);
      for (let i = 0; i < events.length; i += 1)
        events[i].number = state.revision + i + 1;
      try { await this.eventBus.emitEvents(events); }
      catch (e) { throw new ConcurencyError(e); }
      const newState = this.applyEvents(state, events);
      this.stateBus.set(newState);
    } finally {
      this.unlock(stateId);
    }
  }

  protected lock(key: string): Promise<void> {
    const queue = this.queues.get(key);
    if (queue != null) return new Promise(resolve => queue.push(resolve));
    this.queues.set(key, []);
    return Promise.resolve();
  }

  protected getState(stateId: string): Promise<S> {
    const offset = stateId.indexOf('-');
    const category = stateId.substr(0, offset);
    const streamId = stateId.substr(offset + 1);
    return this.stateBus.get(stateId, async (state: S) => {
      await this.eventBus.readFrom(category, streamId, state.revision + 1, (event: E) => {
        state = this.applyEvent(state, event);
        return Promise.resolve();
      });
      return state;
    });
  }

  protected async handleCommand(state: S, command: C): Promise<Array<E>> {
    const { category, streamId, order } = command;
    const handler = this.getCommandHandler(command);
    const events  = <Array<E>> [];
    const emitter = (type: string | E, data?: any, meta?: any) => {
      if (type instanceof E) {
        events.push(type);
      } else {
        events.push(new E(category, streamId, -1, type, data, meta));
      }
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

  protected applyEvents(state: S, events: Array<E>) {
    for (const event of events) {
      const newState = this.applyEvent(state, event);
      if (!(newState instanceof S)) continue ;
      state = newState;
    }
    return state;
  }

  protected applyEvent(state: S, event: E) {
    if (event.meta.persist === false) return state;
    const applier = this.domainHandlers[event.type];
    if (applier != null) {
      try {
        const typer = this.events[event.type];
        if (typer != null) event.data = typer.from(event.data);
      } catch (e) {
        debugger;
        this.logger.warn('Failed on Event: %s-%s %d', event.category, event.streamId, event.type);
        this.logger.warn('Data: %s', event.data);
        throw e;
      }
      this.logger.log('%green %s-%s %j', applier.name, event.category, event.streamId, event.data);
      const newState = applier.call(this.domainHandlers, state, event) || state;
      newState.revision = state.revision + 1;
      return newState;
    } else {
      state.revision += 1;
      return state;
    }
  }

  protected unlock(key: string): void {
    const queue = this.queues.get(key);
    if (queue.length > 0) setImmediate(queue.shift());
    if (queue.length === 0) this.queues.delete(key);
  }

  public async stop(): Promise<void> {
    await Promise.all(this.subscriptions.map(subscription => subscription.abort()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await this.eventBus.stop();
    await this.stateBus.stop();
  }

}
