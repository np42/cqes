import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query }        from './Query';
import { Event }        from './Event';
import { State }        from './State';
import { Reply }        from './Reply';

export interface Config {
  name: string;
}

export class Gateway implements Service.Handler {

  private logger: Logger;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Gateway', 'red');
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public async handleCommand(command: Command): Promise<Reply> {
    return null;
  }

  public async handleQuery(query: Query): Promise<Reply> {
    return null;
  }

}