import { Logger }  from './Logger';
import { State }   from './State';
import { Command } from './Command';
import { Query }   from './Query';
import { Event }   from './Event';
import { Reply }   from './Reply';

interface Bus {
  query(query: Query, timeout?: number): Promise<Reply>;
}

export type Handler = (state: State, command: Command, bus: Bus) => Promise<any>;

export interface Config {
  name:    string;
  empty?:  () => any;
  handle?: Handler;
};

export class Manager {

  private logger:   Logger;
  private config:   Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Manager', 'red');
    this.config = config;
  }

  private empty(): Array<Event> {
    if (this.config.empty != null) {
      return this.config.empty();
    } else {
      return [];
    }
  }

  public async handle(state: State, command: Command, bus: Bus): Promise<Array<Event>> {
    if (this.config.handle != null) {
      this.logger.log('Handle %s : %s', command.key, command.order);
      const limitedBus = { query: (query: Query) => {
        this.logger.log('Query %s:%s', query.view, query.method);
        return bus.query(query);
      } };
      return this.config.handle(state, command, limitedBus);
    } else {
      return this.empty();
    }
  }

}
