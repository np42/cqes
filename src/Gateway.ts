import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query }        from './Query';
import { Event }        from './Event';
import { State }        from './State';
import { Reply }        from './Reply';

export interface Config {
  name:           string;
  init?:          (config: Config) => void;
  start?:         () => Promise<boolean>;
  stop?:          () => Promise<void>;
  handleCommand?: (command: Command) => Promise<Reply>;
  handleQuery?:   (query: Query) => Promise<Reply>
}

export class Gateway implements Service.Handler {

  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Gateway', 'red');
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

  public async handleCommand(command: Command): Promise<Reply> {
    if (this.config.handleCommand != null) {
      this.logger.log('Incoming Command: %s %s', command.key, command.order);
      return this.config.handleCommand(command);
    } else {
      return null;
    }
  }

  public async handleQuery(query: Query): Promise<Reply> {
    if (this.config.handleQuery != null) {
      this.logger.log('Incomming Query: %s->%s', query.view, query.method);
      return this.config.handleQuery(query);
    } else {
      return null;
    }
  }

}