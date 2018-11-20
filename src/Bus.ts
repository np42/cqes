import { CommandBus, Handler as CommandHandler } from './CommandBus';
import { QueryBus, Handler as QueryHandler }     from './QueryBus';

import { AMQPCommandBus as xCommandBus
       , Config as CommandBusConfig
       }                                         from './AMQPCommandBus';
import { AMQPQueryBus as xQueryBus
       , Config as QueryBusConfig
       }                                         from './AMQPQueryBus';

import { Command, OutCommand, InCommand }        from './Command';
import { Query, InQuery, OutQuery }              from './Query';
import { Reply }                                 from './Reply';

export interface Config {
  name:    string;
  Command: string;
  Query:   string;
}

export class Bus {

  public commandBus: CommandBus;
  public queryBus:   QueryBus;

  constructor(config: Config) {
    this.commandBus = new xCommandBus({ name: config.name, url: config.Command });
    this.queryBus   = new xQueryBus({ name: config.name, url: config.Query });
  }

  public async start() {
    if (await this.queryBus.start()) {
      if (await this.commandBus.start()) return true;
      await this.queryBus.stop();
      return false;
    }
    return false;
  }

  public async stop() {
    await this.commandBus.stop();
    await this.queryBus.stop();
  }

  public listen(topic: string, handler: CommandHandler<InCommand>): void {
    return this.commandBus.listen(topic, handler);
  }

  public request(request: Command): Promise<Reply> {
    const outCommand = new OutCommand(request.key, request.order, request.data, request.meta);
    return this.commandBus.request(outCommand);
  }

  public serve(view: string, handler: QueryHandler<InQuery>): void {
    return this.queryBus.serve(view, handler);
  }

  public query(query: Query, timeout?: number): Promise<Reply> {
    const outQuery = new OutQuery(query.view, query.method, query.data, query.meta);
    return this.queryBus.query(outQuery, timeout);
  }

}
