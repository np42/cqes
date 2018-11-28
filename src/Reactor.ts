import { Logger }     from './Logger';
import { Command }    from './Command';
import { State }      from './State';
import { Reply }      from './Reply';
import { Event }      from './Event';

interface Bus {
  request(request: Command, timeout?: number): Promise<Reply>;
}

interface Requester {
  (key: string, order: string, data: any, meta?: any): Promise<Reply>;
}

export interface Config {
  name:     string;
  bus:      Bus;
  produce?: (state: State, events: any, requester: Requester) => void;
};


export class Reactor {

  private logger:    Logger;
  private config:    Config;
  private bus:       Bus;
  private requester: Requester;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Reactor', 'magenta');
    this.config  = config;
    this.bus     = config.bus;
    this.requester = async (key: string, order: string, data: any, meta?: any) => {
      this.logger.log('Produce %s : %s', key, order);
      const command = new Command(key, order, data, meta);
      const reply   = await this.bus.request(command);
      return reply;
    };
  }

  public produce(state: State, events: Array<Event>) {
    if (this.config.produce != null) {
      return this.config.produce(state, events, this.requester);
    } else {
      return null;
    }
  }

}
