import { CommandBus } from './CommandBus';
import { QueryBus }   from './QueryBus';

import { AMQPCommandBus as xCommandBus } from './AMQPCommandBus';
import { AMQPQueryBus   as xQueryBus }   from './AMQPQueryBus';

export interface Options {
  Commands: string,
  Queries:  string,
}

export class Bus {

  public command: CommandBus;
  public query:   QueryBus;

  constructor(config: Options) {
    this.command = new xCommandBus(config.Commands);
    this.query = new xQueryBus(config.Queries);
  }

  async start() {
    return true;
  }

  async stop() {
  }

}
