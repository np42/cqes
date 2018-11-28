import { Logger }       from './Logger';
import { State }        from './State';
import { Repository }   from './Repository';

const CachingMap = require('caching-map');

export interface Config {
  name:        string;
  size?:       number;
  ttl?:        number;
  repository?: Repository;
};

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export type Reducer = (state: State) => State;

export class Buffer {

  private logger:     Logger;
  private buffer:     CachingMap<string, State>;
  private ttl:        number;
  private repository: Repository;

  constructor(config: Config) {
    this.logger     = new Logger(config.name + '.Buffer', 'blue');
    this.buffer     = new CachingMap(config.size > 0 ? config.size : null);
    this.ttl        = config.ttl > 0 ? config.ttl : null;
    this.repository = config.repository;
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
      return new State();
    }
  }

  public update(key: string, expectedVersion: number, reducer: Reducer) {
    const xState = this.buffer.get(key);
    if (xState.version != expectedVersion) throw new Error('State has changed');
    const newState = reducer(xState);
    this.buffer.set(key, newState, { ttl: this.ttl });
    return newState;
  }

}
