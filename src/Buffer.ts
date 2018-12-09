import * as Component   from './Component';

import * as Repository  from './Repository';
import * as Factory     from './Factory';

import { State }        from './State';
import { Event }        from './Event';

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
}

export class Buffer extends Component.Component {
  protected buffer:     CachingMap<string, State>;
  protected ttl:        number;
  public    repository: Repository.Repository;
  public    factory:    Factory.Factory;

  constructor(props: Props, children: Children) {
    super({ type: 'Buffer', color: 'blue', ...props }, children);
    this.buffer = new CachingMap(props.size > 0 ? props.size : null);
    this.ttl    = props.ttl > 0 ? props.ttl : null;
    this.sprout('Repository', Repository);
    this.sprout('Factory', Factory);
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
      return new State(key);
    }
  }

  public update(key: string, expectedVersion: number, events: Array<Event>) {
    const state = this.buffer.get(key);
    if (state.version != expectedVersion) throw new Error('State has changed');
    this.logger.log('%s apply %s', key, events.map(e => e.name).join(' '));
    const newState = this.factory.apply(state, events);
    this.buffer.set(key, newState, { ttl: this.ttl });
    this.repository.save(newState, events);
    return newState;
  }

}
