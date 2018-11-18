import { Logger }       from './Logger';
import { State }        from './State';
import { Translator }   from './Translator';
import { Repository }   from './Repository';

const CachingMap = require('caching-map');

export interface Config {
  name:        string;
  size?:       number;
  ttl?:        number;
  translator:  Translator<State>;
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
  private translator: Translator<State>;
  private repository: Repository;

  constructor(config: Config) {
    this.logger     = new Logger(config.name + '.Buffer', 'blue');
    this.buffer     = new CachingMap(config.size > 0 ? config.size : null);
    this.ttl        = config.ttl > 0 ? config.ttl : null;
    this.translator = new Translator(config.translator);
    this.repository = config.repository;
  }

  public async get(key: string): Promise<State> {
    const state = this.buffer.get(key);
    if (state != null) {
      return state;
    } else if (this.repository != null) {
      const state = await this.repository.load(key);
      const xState = <State>this.translator.decode(state);
      this.buffer.set(key, xState);
      return xState;
    } else {
      return <State>this.translator.decode(new State());
    }
  }

  public update(key: string, expectedVersion: number, reducer: Reducer) {
    const state = this.buffer.get(key);
    if (state.version != expectedVersion) throw new Error('State has changed');
    const xState = reducer(state);
    this.buffer.set(key, xState, { ttl: this.ttl });
    const newState = <State>this.translator.encode(xState);
    this.repository.save(key, newState);
    return xState;
  }

}
