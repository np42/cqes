import { Logger }     from './Logger';
import { Translator } from './Translator';
import { State }      from './State';
import { Command }    from './Command';
import { Query }      from './Query';
import { Event }      from './Event';
import { Reply }      from './Reply';

interface Bus {
  query(query: Query, timeout?: number): Promise<Reply>;
}

interface Requester {
  (view: string, method: string, data: any, meta?: any): Promise<Reply>;
}

export interface Config {
  name:    string;
  bus:     Bus;
  empty?:  () => any;
  handle?: (state: State, command: Command, requester: Requester) => Promise<any>;
  Query?:  Translator<Query>;
  Reply?:  Translator<Reply>;
};

export class Manager {

  private logger:    Logger;
  private config:    Config;
  private bus:       Bus;
  private query:     Translator<Query>;
  private reply:     Translator<Reply>;
  private requester: Requester;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Manager', 'red');
    this.config = config;
    this.bus    = config.bus;
    this.query  = new Translator(config.Query);
    this.reply  = new Translator(config.Reply);
    this.requester = async (view: string, method: string, data: any, meta?: any) => {
      this.logger.log('Query %s:%s', view, method);
      const xQuery = new Query(view, method, data, meta);
      const query  = this.query.encode(xQuery);
      const reply  = await this.bus.query(query);
      const xReply = this.reply.decode(reply);
      return xReply;
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
      this.logger.log('Handle %s : %s', command.key, command.order);
      return this.config.handle(state, command, this.requester);
    } else {
      return this.empty();
    }
  }

}
