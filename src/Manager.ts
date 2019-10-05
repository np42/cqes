import * as Component   from './Component';
import { CommandBus }   from './CommandBus';
import { EventBus }     from './EventBus';
import { StateBus }     from './StateBus';
import { Command as C } from './Command';
import { Event   as E } from './Event';
import { State   as S } from './State';
import { Typer }        from './Type';

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

  constructor(props: props) {
    super(props);
    this.commandBuses    = props.commandBuses    || {};
    this.eventBus        = props.eventBus;
    this.stateBus        = props.stateBus;
    this.commandHandlers = props.commandHandlers || {};
    this.domainHandlers  = props.domainHandlers  || {};
    this.events          = props.events          || {};
    this.subscriptions   = [];
  }

  public start(): Promise<void> {
    return <any> Promise.all(Object.keys(this.commandBuses).map(name => {
      return this.commandBuses[name].listen((command: C) => this.handleManagerCommand(command))
    }));
  }

  protected getCommandHandler(command: C) {
    const fullname = command.category + '_' + command.order;
    if (fullname in this.commandHandlers) return this.commandHandlers[fullname];
    const shortname = command.order;
    if (shortname in this.commandHandlers) return this.commandHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.commandHandlers) return this.commandHandlers[wildname];
    return (state: S, command: C) => {
      this.logger.warn('Command %s from %s has been lost', command.category, command.order);
    };
  }

  protected async handleManagerCommand(command: C): Promise<void> {
    const id      = command.category + '-' + command.streamId;
    const state   = await this.stateBus.get(id);
    const handler = this.getCommandHandler(command);
    const events  = <Array<E>> [];
    const emitter = (type: string, data: any, meta?: any) => {
      events.push(new E(command.category, command.streamId, -1, type, data, meta));
    };
    const returnedEvents = handler(state, command, emitter);
    if (returnedEvents instanceof Array) Array.prototype.push.apply(events, returnedEvents);
    else if (returnedEvents instanceof E) events.push(returnedEvents);
    if (events.length == 0) return ;
    const newState = events.reduce((state, event, offset) => {
      const Typer = this.events[event.type];
      if (Typer != null) event.data = new Typer(event.data);
      event.number = state.revision + offset;
      const applier  = this.domainHandlers[event.type];
      if (applier != null) {
        const newState = applier(state, event) || state;
        newState.revision = state.revision + 1;
        return newState;
      } else {
        state.revision += 1;
        return state;
      }
    }, state);
    await this.eventBus.emitEvents(events);
    this.stateBus.set(id, newState);
  }

  public async stop(): Promise<void> {
    return <any> Promise.all(this.subscriptions.map(subscription => subscription.abort()));
  }

}
