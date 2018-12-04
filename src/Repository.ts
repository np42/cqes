import { Logger }       from './Logger';
import { Query }        from './Query';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Config {
  name:         string;
  init?:        (config: any) => void;
  start?:       () => Promise<boolean>;
  stop?:        () => Promise<void>;
  load?:        (key: string) => Promise<State>;
  save?:        (state: State, events: Array<Event>) => Promise<void>;
  handleQuery?: (query: Query) => Promise<Reply>;
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

  public save(state: State, events: Array<Event>): Promise<void> {
    if (this.config.save != null) {
      this.logger.log('Saving %s@%s -> %s', state.version, state.key, state.status);
      return this.config.save(state, events);
    } else {
      return Promise.resolve();
    }
  }

  public async load(key: string): Promise<State> {
    if (this.config.load != null) {
      const state = await this.config.load(key);
      this.logger.log('Loading %s : %s', key, state.status);
      return state;
    } else {
      return Promise.resolve(new State(key));
    }
  }

  public handleQuery(query: Query): Promise<Reply> {
    if (this.config.handleQuery != null) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      return this.config.handleQuery(query);
    } else {
      return Promise.resolve(new Reply(null, null));
    }
  }

}
