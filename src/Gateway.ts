import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query, Reply } from './Query';
import { Event }        from './Event';
import { State }        from './State';

export interface Config {
  name: string;
}

export class Gateway implements Service.Handler {

  private logger: Logger;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Gateway', 'red.bold');

  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public async handleCommand(command: Command): Promise<Service.Result> {
    return null;
  }

  public async handleQuery(query: Query): Promise<Reply> {
    return null;
  }

}