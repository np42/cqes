import * as Component             from './Component';
import { StateBus }               from './StateBus';
import { EventBus, Subscription } from './EventBus';
import { State as S }             from './State';
import { Event as E }             from './Event';
import { Typer }                  from 'cqes-type';
const CachingMap                  = require('caching-map');

export type domainHandler  = (state: S, event: E) => S;

export interface Events          { [name: string]: Typer };
export interface DomainHandlers  { [name: string]: domainHandler };

export interface props extends Component.props {
  stateBus?:        StateBus;
  eventBus?:        EventBus;
  events?:          Events;
  domainHandlers?:  DomainHandlers;
  cacheSize?:       number;
}

export class Repository extends Component.Component {
  protected stateBus:       StateBus;
  protected cache:          Map<string, S>
  protected eventBus:       EventBus;
  protected subscription:   Subscription;
  protected domainHandlers: DomainHandlers;
  protected events:         Events;

  constructor(props: props) {
    super(props);
    this.stateBus       = props.stateBus;
    this.cache          = new CachingMap({ size: props.cacheSize || 1000 });
    this.eventBus       = props.eventBus;
    this.domainHandlers = props.domainHandlers;
    this.events         = props.events;
  }

  public async start(): Promise<void> {
    await this.eventBus.start();
    this.subscription = await this.eventBus.subscribe((event: E) => {
      this.handleEvent(event);
      return Promise.resolve();
    });
    await this.stateBus.start();
  }

  public async get(stream: string) {
    const cached = this.cache.get(stream);
    if (cached != null) return cached;
    const snapshot = await this.stateBus.get(stream);
    const offset = stream.indexOf('-');
    const category = stream.substr(0, offset);
    const streamId = stream.substr(offset + 1);
    let state = snapshot;
    await this.eventBus.readFrom(category, streamId, snapshot.revision, (event: E) => {
      state = this.applyEvent(state, event);
      return Promise.resolve();
    });
    this.cache.set(stream, state);
    return state;
  }

  protected handleEvent(event: E) {
    const cached = this.cache.get(event.stream);
    if (cached == null) return ;
    const state = this.applyEvent(cached, event);
    this.cache.set(event.stream, state);
    this.stateBus.set(state);
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

  public expire(streamId: string) {
    this.cache.delete(streamId);
  }

  public async stop(): Promise<void> {
    await this.subscription.abort();
    await this.eventBus.stop();
    await this.stateBus.stop();
  }

}