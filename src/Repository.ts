import { Logger } from './Logger';
import { State }  from './State';
import { Query }  from './Query';

const CachingMap = require('caching-map');

export type Config   = { name: string, size?: int };
export type Buffer   = Map<string, State>;
export type Handler  = (buffer: Buffer, query: Query) => any;
export interface Handlers {
  load: (key: string) => Promise<State>;
  save: (key: string, state: State) => Promise<void>;
  [view: string]: Handler;
};
export type Reducer  = (state: State, events: Array<Event>) => State;

export class Repository {

  private logger:   Logger;
  private buffer:   Buffer;
  private size:     number;
  private handlers: Handlers;

  constructor(config: Config, handlers: Handlers) {
    this.logger   = new Logger(config.name + '.Repository', 'blue');
    this.size     = config.size > 0 ? config.size : Infinity;
    this.buffer   = CachingMap(this.size);
    this.handlers = handlers;
    if (handlers.load != null) this.load = handlers.load;
    if (handlers.save != null) this.save = handlers.save;
  }

  public save(key: string, state: State): Promise<void> {
    return Promise.resolve();
  }

  private load(key: string): Promise<State> {
    return Promise.resolve(new State());
  }

  public async get(key: string): Promise<State> {
    const state = this.buffer.get(key);
    if (state != null) {
      return state;
    } else {
      const state = await this.load(key);
      this.buffer.set(key, state);
      return state;
    }
  }

  public update(key: string, expectedVersion: number, reducer: Reducer, events: Array<Event>) {
    const state = this.buffer.get(key);
    if (state == null) throw new Error('State must exists');
    if (state.version != expectedVersion) throw new Error('State has changed');
    const newState = reducer(state, events);
    this.buffer.set(key, newState);
    this.save(key, newState);
    return newState;
  }

  public resolve(query: Query): Promise<any> {
    const handlerNamed = this.handlers['query' + query.view];
    if (handlerNamed != null) return handlerNamed(this.buffer, query);
    return Promise.resolve(null);
  }

}
