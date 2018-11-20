import { Translator }                     from './Translator';
import { Command, InCommand, OutCommand } from './Command';
import { Query, InQuery }                 from './Query';
import { Reply }                          from './Reply';

import * as Bus                           from './Bus';
import * as Debouncer                     from './Debouncer';
import * as Throttler                     from './Throttler';

export interface Config {
  name:       string;
  Bus:        Bus.Config;
  Debouncer?: Debouncer.Config;
  Throttler?: Throttler.Config;
  Command?:   Translator<Command>;
  Query?:     Translator<Query>;
  Reply?:     Translator<Reply>;
  Handler:    Handler;
}

export interface Handler {
  init?:         (config: Config) => void;
  start:         () => Promise<boolean>;
  stop:          () => Promise<void>;
  handleCommand: (command: Command, bus: Bus.Bus) => Promise<Reply>;
  handleQuery:   (query: Query, bus: Bus.Bus) => Promise<Reply>;
}

export class Service {
  private name:      string;
  private bus:       Bus.Bus;
  private debouncer: Debouncer.Debouncer;
  private throttler: Throttler.Throttler;
  private command:   Translator<Command>;
  private query:     Translator<Query>;
  private reply:     Translator<Reply>;
  private handler:   Handler;

  constructor(config: Config) {
    this.name      = config.name;
    this.bus       = new Bus.Bus(config.Bus);
    this.command   = new Translator(config.Command);
    this.debouncer = new Debouncer.Debouncer(config.Debouncer);
    this.query     = new Translator(config.Query);
    this.throttler = new Throttler.Throttler(config.Throttler);
    this.reply     = new Translator(config.Reply);
    this.handler   = config.Handler;
  }

  public async start() {
    if (await this.handler.start()) {
      await this.bus.start();

      this.bus.listen(this.name, async (command: InCommand) => {
        this.debouncer.satisfy(command, async () => {
          const xCommand = <Command>this.command.decode(command);
          const xReply   = await this.handler.handleCommand(xCommand, this.bus);
          return <Reply>this.reply.encode(xReply);
        });
      });

      this.bus.serve(this.name, async (query: InQuery) => {
        this.throttler.satisfy(query, async () => {
          debugger;
          const xQuery = <Query>this.query.decode(query);
          const xReply = await this.handler.handleQuery(query, this.bus);
          return <Reply>this.reply.encode(xReply);
        });
      });

      return true;
    } else {
      return false;
    }
  }

  public async stop() {
    await this.bus.stop();
    await this.handler.stop()
  }

}
