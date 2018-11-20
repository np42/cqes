import { Logger } from './Logger';

import { Command } from './Command';
import { State }   from './State';
import { Event }   from './Event';

interface Bus {
  request(request: Command): void;
}

export interface Config {
  name:     string;
  produce?: (state: State, events: any, bus: Bus) => void;
};


export class Reactor {

  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Reactor', 'magenta');
    this.config = config;
  }

  public produce(state: State, events: Array<Event>, bus: Bus) {
    if (this.config.produce != null) {
      const limitedBus = { request: (request: Command) => {
        this.logger.log('Produce %s > %s:%s', state.status, request.key, request.order);
        bus.request(request);
      } };
      return this.config.produce(state, events, limitedBus);
    } else {
      return null;
    }
  }

}
