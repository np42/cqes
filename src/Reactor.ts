import { Logger }     from './Logger';
import { Translator } from './Translator';
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
  Command?: Translator<Command>;
  Reply?:   Translator<Reply>;
};


export class Reactor {

  private logger:    Logger;
  private config:    Config;
  private bus:       Bus;
  private command:   Translator<Command>;
  private reply:     Translator<Reply>;
  private requester: Requester;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Reactor', 'magenta');
    this.config  = config;
    this.bus     = config.bus;
    this.command = new Translator(config.Command);
    this.reply   = new Translator(config.Reply);
    this.requester = async (key: string, order: string, data: any, meta?: any) => {
      this.logger.log('Produce %s : %s', key, order);
      const xCommand = new Command(key, order, data, meta);
      const command  = this.command.encode(xCommand);
      const reply    = await this.bus.request(command);
      const xReply   = this.reply.decode(reply);
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
