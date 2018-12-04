import { Logger } from './Logger';

import { Command } from './Command';
import { State }   from './State';
import { Event }   from './Event';
import { Reply }   from './Reply';

export interface Config {
  name:      string;
  resolve?:  (command: Command, state: State, events: any) => Reply;
};

export class Responder {

  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Responder', 'red');
    this.config = config;
  }

  public resolve(command: Command, state: State, events: Array<Event>) {
    if (this.config.resolve != null) {
      try {
        const result = this.config.resolve(command, state, events);
        if (result instanceof Reply) {
          this.logger.log("Resolve %s:%s > %s", command.key, command.order, JSON.stringify(result.data));
          return result;
        } else {
          this.logger.log("Resolve %s:%s > %s", command.key, command.order, JSON.stringify(result));
          return new Reply(null, result);
        }
      } catch (e) {
        return new Reply(String(e));
      }
    } else {
      return new Reply(null, null);
    }
  }

}
