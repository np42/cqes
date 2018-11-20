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
      const reply = this.config.resolve(command, state, events);
      this.logger.log("Resolve %s:%s > %s", command.key, command.order, JSON.stringify(reply));
      return reply;
    } else {
      return new Reply(null, null);
    }
  }

}
