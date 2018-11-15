import { Logger }       from './Logger';
import { Query, Reply } from './Query';
import { State }        from './State';
import { Event }        from './Event';

const CachingMap = require('caching-map');

export type Handler  = (buffer: Buffer, query: Query) => Promise<Reply>;

export type Handlers = { [view: string]: Handler };

export interface Config {
  name:  string;
  size?: number;
  start?: () => Promise<boolean>;
  stop?:  () => Promise<void>;
  load?: (key: string) => Promise<State>;
  save?: (key: string, state: State) => Promise<void>;
  handlers: Handlers;
};

export type Buffer   = Map<string, State>;

export type Reducer  = (state: State, events: Array<Event>) => State;

export class Repository {

  private logger:   Logger;
  private buffer:   Buffer;
  private size:     number;
  private handlers: Handlers;

  constructor(config: Config) {
    this.logger   = new Logger(config.name + '.Repository', 'blue');
    this.size     = config.size > 0 ? config.size : Infinity;
    this.buffer   = CachingMap(this.size);
    this.handlers = config.handlers;
    if (config.start != null) this.start = config.start;
    if (config.stop != null)  this.stop  = config.stop;
    if (config.load != null)  this.load  = config.load;
    if (config.save != null)  this.save  = config.save;
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
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
    if (state == null) throw new Error('State must exists'); // fecthed just before
    if (state.version != expectedVersion) throw new Error('State has changed');
    const newState = reducer(state, events);
    this.buffer.set(key, newState);
    this.save(key, newState); // do not wait for response
    return newState;
  }

  public resolve(query: Query): Promise<Reply> {
    const handlerNamed = this.handlers['query' + query.view];
    if (handlerNamed != null) return handlerNamed(this.buffer, query);
    return Promise.resolve(null);
  }

}
