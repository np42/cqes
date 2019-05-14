import { Logger }                                from './Logger';

import { CommandBus, Handler as CommandHandler } from './CommandBus';
import { QueryBus, Handler as QueryHandler }     from './QueryBus';

import { AMQPCommandBus as xCommandBus
       , Props as CommandBusConfig
       }                                         from './AMQPCommandBus';
import { AMQPQueryBus as xQueryBus
       , Props as QueryBusConfig
       }                                         from './AMQPQueryBus';

import { Command, OutCommand, InCommand }        from './Command';
import { Query, InQuery, OutQuery }              from './Query';
import { Reply }                                 from './Reply';

export interface Props {
  name:     string;
  Command:  CommandBusConfig;
  Query:    QueryBusConfig;
  Service?: { ns?: string };
}

export interface Children {}

export class Bus {
  public logger:     Logger;
  public commandBus: CommandBus;
  public queryBus:   QueryBus;

  constructor(props: Props, children: Children) {
    this.logger     = new Logger(props.name + '.Bus', 'white');
    const ns = props.Service && props.Service.ns || '';
    this.commandBus = new xCommandBus({ name: props.name, ...props.Command, ns });
    this.queryBus   = new xQueryBus({ name: props.name, ...props.Query, ns });
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

  //--
  public command(key: string, order: string, data?: any, meta?: any): Promise<Reply> {
    this.logger.log('%red %s : %s', 'Command', key, order);
    const outCommand = new OutCommand(key, order, data, meta);
    return this.commandBus.request(outCommand);
  }

  public listen(topic: string, handler: CommandHandler<InCommand>): void {
    return this.commandBus.listen(topic, handler);
  }

  //--
  public query(view: string, method?: string, data?: any, meta?: any): Promise<Reply> {
    this.logger.log('%blue %s -> %s', 'Query', view, method);
    const outQuery = new OutQuery(view, method, data, meta);
    return this.queryBus.query(outQuery);
  }

  public serve(view: string, handler: QueryHandler<InQuery>): void {
    return this.queryBus.serve(view, handler);
  }


}
