import { Logger }       from './Logger';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { Translator }   from './Translator';
import { State }        from './State';

export interface Config {
  name:     string;
  init?:    (config: any) => void;
  start?:   () => Promise<boolean>;
  stop?:    () => Promise<void>;
  load?:    (key: string) => Promise<State>;
  save?:    (key: string, state: State) => Promise<void>;
  resolve?: (query: Query) => Promise<Reply>;
  State?:   Translator<State>;
};

export class Repository {

  private logger: Logger;
  private config: Config;
  private state:  Translator<State>;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Repository', 'blue');
    this.config = config;
    this.state  = new Translator(config.State);
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

  public save(key: string, xState: State): Promise<void> {
    if (this.config.save != null) {
      const state = <State>this.state.encode(xState);
      this.logger.log('Saving %s@%s -> %s', xState.version, key, state.status);
      return this.config.save(key, state);
    } else {
      return Promise.resolve();
    }
  }

  public async load(key: string): Promise<State> {
    if (this.config.load != null) {
      const state = await this.config.load(key);
      this.logger.log('Loading %s : %s', key, state.status);
      const xState = <State>this.state.decode(state);
      return xState;
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
