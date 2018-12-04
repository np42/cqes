import { Logger }       from './Logger';
import { State }        from './State';
import { Event }        from './Event';
import { Repository }   from './Repository';
import { Factory }      from './Factory';

const CachingMap = require('caching-map');

export interface Config {
  name:        string;
  size?:       number;
  ttl?:        number;
  repository?: Repository;
  factory?:    Factory;
};

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export class Buffer {

  private logger:     Logger;
  private buffer:     CachingMap<string, State>;
  private ttl:        number;
  private repository: Repository;
  private factory:    Factory;

  constructor(config: Config) {
    this.logger     = new Logger(config.name + '.Buffer', 'blue');
    this.buffer     = new CachingMap(config.size > 0 ? config.size : null);
    this.ttl        = config.ttl > 0 ? config.ttl : null;
    this.repository = config.repository;
    this.factory    = config.factory;
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
    return newState;
  }

}
