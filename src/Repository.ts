import { Logger }       from './Logger';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Config {
  name:     string;
  start?:   () => Promise<boolean>;
  stop?:    () => Promise<void>;
  load?:    (key: string) => Promise<State>;
  save?:    (key: string, state: State) => Promise<void>;
  resolve?: (query: Query) => Promise<Reply>;
};

export class Repository {

  constructor(config: Config) {
    if (config.start != null)   this.start   = config.start;
    if (config.stop != null)    this.stop    = config.stop;
    if (config.load != null)    this.load    = config.load;
    if (config.save != null)    this.save    = config.save;
    if (config.resolve != null) this.resolve = config.resolve;
  }

  // @override
  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  // @override
  public stop(): Promise<void> {
    return Promise.resolve();
  }

  // @override
  public save(key: string, state: State): Promise<void> {
    return Promise.resolve();
  }

  // @override
  public load(key: string): Promise<State> {
    return Promise.resolve(new State());
  }

  // @override
  public resolve(query: Query): Promise<Reply> {
    return Promise.resolve(null);
  }

}
