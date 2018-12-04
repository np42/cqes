import { Logger }     from './Logger';
import { State }      from './State';
import { Command }    from './Command';
import { Query }      from './Query';
import { Event }      from './Event';
import { Reply }      from './Reply';

interface Bus {
  query(query: Query, timeout?: number): Promise<Reply>;
}

interface Querier {
  (view: string, method: string, data: any, meta?: any): Promise<Reply>;
}

export interface Config {
  name:    string;
  bus:     Bus;
  empty?:  () => any;
  handle?: (state: State, command: Command, querier: Querier) => Promise<any>;
};

export class Manager {

  private logger:    Logger;
  private config:    Config;
  private bus:       Bus;
  private querier:   Querier;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Manager', 'red');
    this.config  = config;
    this.bus     = config.bus;
    this.querier = async (view: string, method: string, data: any, meta?: any) => {
      this.logger.log('Query %s -> %s', view, method);
      const query  = new Query(view, method, data, meta);
      const reply  = await this.bus.query(query);
      return reply;
    };
  }

  private empty(): Array<Event> {
    if (this.config.empty != null) {
      return this.config.empty();
    } else {
      return [];
    }
  }

  public async handle(state: State, command: Command): Promise<Array<Event>> {
    if (this.config.handle != null) {
      this.logger.log('Handle %s : %s %j', command.key, command.order, command.data);
      return this.config.handle(state, command, this.querier);
    } else {
      return this.empty();
    }
  }

}
