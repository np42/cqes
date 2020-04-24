import * as Component             from './Component';
import { StateBus }               from './StateBus';
import { EventBus, Subscription } from './EventBus';
import * as Domain                from './DomainHandlers';
import { State as S }             from './State';
import { StateRevision }          from './State';
import { Event as E }             from './Event';
import { Typer }                  from 'cqes-type';
const CachingMap                  = require('caching-map');

export { Domain };

export interface Events          { [name: string]: Typer };
export interface DomainHandlers  { [name: string]: Domain.handler };

export interface props extends Component.props {
  category?:        string;
  stateBus?:        StateBus;
  eventBus?:        EventBus;
  domainHandlers?:  Domain.Handlers;
  cacheSize?:       number;
}

export class Repository extends Component.Component {
  protected category:       string;
  protected stateBus:       StateBus;
  protected cache:          Map<string, S>;
  protected eventBus:       EventBus;
  protected subscription:   Subscription;
  protected domainHandlers: Domain.Handlers;

  constructor(props: props) {
    super(props);
    this.category       = props.category;
    this.stateBus       = props.stateBus;
    this.cache          = new CachingMap({ size: props.cacheSize || 1000 });
    this.eventBus       = props.eventBus;
    this.domainHandlers = props.domainHandlers;
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await this.stateBus.start();
    await this.domainHandlers.start();
    await this.eventBus.start();
    this.subscription = await this.eventBus.subscribe(event => this.handleEvent(event));
  }

  public async get(streamId: string) {
    const cached = this.cache.get(streamId);
    if (cached != null) return cached;
    const snapshot = await this.stateBus.get(streamId);
    const revision = snapshot.revision;
    let state = snapshot;
    await this.eventBus.readFrom(this.category, streamId, revision + 1, (event: E) => {
      state = this.applyEvent(state, event);
      return Promise.resolve();
    });
    this.cache.set(streamId, state);
    if (revision < state.revision) this.stateBus.set(state);
    return state;
  }

  protected handleEvent(event: E): Promise<void> {
    const cached = this.cache.get(event.streamId);
    if (cached == null) return Promise.resolve();
    const initialRevision = cached.revision;
    const state = this.applyEvent(cached, event);
    if (event.meta?.$deleted) state.revision = StateRevision.Delete;
    if (state.revision < 0) this.cache.delete(event.streamId);
    if (state.revision === initialRevision) return Promise.resolve();
    return this.stateBus.set(state);
    return Promise.resolve();
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
    if (event.meta?.$persistent === false) return state;
    const applier = <Domain.handler>(<any>this.domainHandlers)[event.type];
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

  public expire(streamId: string) {
    this.cache.delete(streamId);
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.subscription.abort();
    await this.eventBus.stop();
    await this.domainHandlers.stop();
    await this.stateBus.stop();
    await super.stop();
  }

}