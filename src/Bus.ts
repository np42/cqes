import { Logger }     from './Logger';

import { CommandBus } from './CommandBus';
import { QueryBus }   from './QueryBus';

import { command }    from './command';
import { query }      from './query';
import { reply }      from './reply';

export interface props {
  CommandBus: CommandBus.props;
  QueryBus:   QueryBus.props;
}

export interface children {
  CommandBus: { new(props: CommandBus.props, children: CommandBus.children): CommandBus.CommandBus };
  QueryBus:   { new(props: CommandBus.props, children: CommandBus.children): CommandBus.CommandBus };
}

export class Bus extends Component.Component {
  public command: CommandBus;
  public query:   QueryBus;

  constructor(props: Props, children: Children) {
    super(props, children);
    this.command = this.sprout('CommandBus', CommandBus);
    this.query   = this.sprout('QueryBus', QueryBus);
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
