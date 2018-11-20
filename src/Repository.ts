import { Logger }       from './Logger';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Config {
  name:     string;
  init?:    (config: any) => void;
  start?:   () => Promise<boolean>;
  stop?:    () => Promise<void>;
  load?:    (key: string) => Promise<State>;
  save?:    (key: string, state: State) => Promise<void>;
  resolve?: (query: Query) => Promise<Reply>;
};

export class Repository {

  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Repository', 'blue');
    this.config = config;
    if (config.init != null) config.init(config);
  }

  public start(): Promise<boolean> {
    if (this.config.start != null) {
      this.logger.log('Starting');
      return this.config.start();
    } else {
      return Promise.resolve(true);
    }
  }

  public stop(): Promise<void> {
    if (this.config.stop != null) {
      this.logger.log('Stoping');
      return this.config.stop();
    } else {
      return Promise.resolve();
    }
  }

  public save(key: string, state: State): Promise<void> {
    if (this.config.save != null) {
      this.logger.log('Saving %s@%s -> %s', state.version, key, state.status);
      return this.config.save(key, state);
    } else {
      return Promise.resolve();
    }
  }

  public load(key: string): Promise<State> {
    if (this.config.load != null) {
      this.logger.log('Loading %s', key);
      return this.config.load(key);
    } else {
      return Promise.resolve(new State());
    }
  }

  public resolve(query: Query): Promise<Reply> {
    if (this.config.resolve != null) {
      this.logger.log('Resolving %s->%s', query.view, query.method);
    } else {
      return Promise.resolve(new Reply(null, null));
    }
  }

}
