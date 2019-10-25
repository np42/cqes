import * as Component      from './Component';
import { CommandBus }      from './CommandBus';
import { ConcurencyError } from './CommandBus';
import { EventBus }        from './EventBus';
import { StateBus }        from './StateBus';
import { Command as C }    from './Command';
import { Event   as E }    from './Event';
import { State   as S }    from './State';
import { Typer }           from './Type';

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
  noopBus?:         EventBus;
  eventBus?:        EventBus;
  commandHandlers?: CommandHandlers;
  domainHandlers?:  DomainHandlers;
  events?:          Events;
}

export class Manager extends Component.Component {
  protected commandBuses:    CommandBuses;
  protected stateBus:        StateBus;
  protected noopBus:         EventBus;
  protected eventBus:        EventBus;
  protected commandHandlers: CommandHandlers;
  protected domainHandlers:  DomainHandlers;
  protected events:          Events;
  protected subscriptions:   Array<Subscription>;

  constructor(props: props) {
    super(props);
    this.commandBuses    = props.commandBuses    || {};
    this.noopBus         = props.noopBus;
    this.eventBus        = props.eventBus;
    this.stateBus        = props.stateBus;
    this.commandHandlers = props.commandHandlers || {};
    this.domainHandlers  = props.domainHandlers  || {};
    this.events          = props.events          || {};
    this.subscriptions   = [];
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
    const { category, streamId, order } = command;
    const stateId = category + '-' + streamId;
    const state   = await this.stateBus.get(stateId, async (state: S) => {
      await this.eventBus.readFrom(category, streamId, state.revision + 1, (event: E) => {
        state = this.applyEvent(state, event);
        return Promise.resolve();
      });
      return state;
    });
    const handler = this.getCommandHandler(command);
    const events  = <Array<E>> [];
    const emitter = (type: string | E, data?: any, meta?: any) => {
      if (type instanceof E) {
        events.push(type);
      } else {
        events.push(new E(category, streamId, -1, type, data, meta));
      }
    };
    this.logger.log('%red %s-%s %j', handler.name, category, streamId, command.data);
    try {
      const returnedEvents = await handler.call(this.commandHandlers, state, command, emitter);
      if (returnedEvents instanceof Array) Array.prototype.push.apply(events, returnedEvents);
      else if (returnedEvents instanceof E) events.push(returnedEvents);
    } catch (e) {
      const meta = { ...command.meta, stack: e.stack };
      const data = { type: e.name, message: e.toString() };
      const noop = new E('@DeadLetter', streamId, -2, 'Error', data, meta);
      this.logger.log('%yellow %s-%s %j', 'Error:' + order, category, streamId, command.data);
      await this.noopBus.emitEvents([noop]);
      return ;
    }
    if (events.length == 0) {
      const meta = { ...command.meta, command: { category, order } };
      const noop = new E('@DeadLetter', streamId, -2, 'NoOp', command.data, meta);
      this.logger.log('%yellow %s-%s %j', 'NoOp:' + order, category, streamId, command.data);
      await this.noopBus.emitEvents([noop]);
      return ;
    }
    const newState = events.reduce((state, event) => {
      const typer  = this.events[event.type];
      if (typer != null) event.data = typer.from(event.data);
      event.number = state.revision + 1;
      const newState = this.applyEvent(state, event);
      if (newState instanceof S) return newState;
      return state;
    }, state);
    try { await this.eventBus.emitEvents(events); }
    catch (e) { throw new ConcurencyError(e); }
    this.stateBus.set(newState);
  }

  protected applyEvent(state: S, event: E) {
    const applier = this.domainHandlers[event.type];
    if (applier != null) {
      this.logger.log('%green %s-%s %j', applier.name, event.category, event.streamId, event.data);
      const newState = applier.call(this.domainHandlers, state, event) || state;
      newState.revision = state.revision + 1;
      return newState;
    } else {
      state.revision += 1;
      return state;
    }
  }

  public async stop(): Promise<void> {
    await Promise.all(this.subscriptions.map(subscription => subscription.abort()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await this.eventBus.stop();
    await this.stateBus.stop();
  }

}
