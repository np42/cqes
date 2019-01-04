import * as Component   from './Component';

import * as Repository  from './Repository';
import * as Factory     from './Factory';

import { State }        from './State';
import { Event }        from './Event';
import { Query }        from './Query';
import { Reply }        from './Reply';

const CachingMap = require('caching-map');

export interface Props extends Component.Props {
  size?:       number;
  ttl?:        number;
  Repository?: Repository.Props;
  Factory?:    Factory.Props;
}

export interface Children extends Component.Children {
  Repository: { new(props: Repository.Props, children: Repository.Children): Repository.Repository };
  Factory:    { new(props: Factory.Props, children: Factory.Children): Factory.Factory };
}

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
  delete(key: K): void;
}

export class Buffer extends Component.Component {
  protected buffer:     CachingMap<string, State>;
  protected ttl:        number;
  public    repository: Repository.Repository;
  public    factory:    Factory.Factory;

  constructor(props: Props, children: Children) {
    super({ type: 'Buffer', ...props }, children);
    this.buffer     = new CachingMap('size' in props ? props.size : 100);
    this.ttl        = props.ttl > 0 ? props.ttl : null;
    this.repository = this.sprout('Repository', Repository);
    this.factory    = this.sprout('Factory', Factory);
  }

  public async get(key: string): Promise<State> {
    const state = this.buffer.get(key);
    if (state != null) {
      return state;
    } else if (this.repository != null) {
      const state = await this.repository.load(key);
      this.buffer.set(key, state);
      return state;
    } else {
      return new State(key, this.repository.empty());
    }
  }

  public update(key: string, expectedVersion: number, events: Array<Event>) {
    const state = this.buffer.get(key);
    if (state.version != expectedVersion) throw new Error('State has changed');
    this.logger.log('%s apply %s', key, events.map(e => e.name).join(', '));
    const newState = this.factory.apply(state, events);
    this.logger.log('State %s@%s (%s): %j', newState.version, newState.key, newState.status, newState.data);
    if (newState.version === -1) this.buffer.delete(key);
    else this.buffer.set(key, newState, { ttl: this.ttl });
    this.repository.save(newState, events);
    return newState;
  }

  //--

  public resolve(query: Query): Promise<Reply> {
    return this.repository.resolve(query, <any>this.buffer);
  }

  //--

  public start(): Promise<boolean> {
    return this.repository.start();
  }

  public stop(): Promise<void> {
    return this.repository.stop();
  }

}
