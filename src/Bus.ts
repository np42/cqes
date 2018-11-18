import { CommandBus } from './CommandBus';
import { QueryBus }   from './QueryBus';

import { AMQPCommandBus as xCommandBus
       , Config as CommandBusConfig
       }              from './AMQPCommandBus';
import { AMQPQueryBus as xQueryBus
       , Config as QueryBusConfig
       }              from './AMQPQueryBus';

export interface Config {
  name:    string;
  Command: string;
  Query:   string;
}

export class Bus {

  public command: CommandBus;
  public query:   QueryBus;

  constructor(config: Config) {
    this.command = new xCommandBus({ name: config.name, url: config.Command });
    this.query   = new xQueryBus({ name: config.name, url: config.Query });
  }

  public async start() {
    if (await this.query.start()) {
      if (await this.command.start()) return true;
      await this.query.stop();
      return false;
    }
    return false;
  }

  public async stop() {
    await this.command.stop();
    await this.query.stop();
  }

}
