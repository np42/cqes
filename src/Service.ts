import { Logger }                         from './Logger';
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
  Handler:    Handler;
}

export interface Handler {
  init?:          (config: Config, bus: Bus.Bus) => void;
  start:          () => Promise<boolean>;
  stop:           () => Promise<void>;
  handleCommand?: (command: Command) => Promise<Reply>;
  handleQuery?:    (query: Query) => Promise<Reply>;
}

export class Service {
  private name:      string;
  private logger:    Logger;
  private bus:       Bus.Bus;
  private debouncer: Debouncer.Debouncer;
  private throttler: Throttler.Throttler;
  private handler:   Handler;

  constructor(config: Config) {
    this.name      = config.name;
    this.logger    = new Logger(this.name + '.Service', 'grey');
    this.bus       = new Bus.Bus(config.Bus);
    this.throttler = new Throttler.Throttler(config.Throttler);
    this.debouncer = new Debouncer.Debouncer(config.Debouncer);
    this.handler   = config.Handler;
    if (this.handler.init != null) this.handler.init(<any>config.Handler, this.bus);
    if (this.handler.start == null) this.logger.error('Missing .start method');
    if (this.handler.stop == null)  this.logger.error('Missing .stop method');
  }

  public async start() {
    if (await this.handler.start()) {
      await this.bus.start();

      if (typeof this.handler.handleCommand == 'function') {
        this.logger.log('Listening %s.Command', this.name);
        this.bus.listen(this.name, async (command: InCommand) => {
          this.debouncer.satisfy(command, command => {
            return this.handler.handleCommand(command);
          });
        });
      }

      if (typeof this.handler.handleQuery == 'function') {
        this.logger.log('Serving %s.Query', this.name);
        this.bus.serve(this.name, async (query: InQuery) => {
          this.throttler.satisfy(query, query => {
            return this.handler.handleQuery(query);
          });
        });
      }

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
