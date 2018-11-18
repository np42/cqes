import * as Bus         from './Bus';

import { Translator }                     from './Translator';
import { Command, InCommand, OutCommand } from './Command';
import { Query, InQuery }                 from './Query';
import { Reply }                          from './Reply';

export interface Typers {
  Command?: Translator<Command, Command>;
  Query?:   Translator<Query, Reply>;
}

export interface Result {
  reply:    Reply;
  commands: Array<Command>;
};

export interface Handler {
  start: () => Promise<boolean>;
  stop:  () => Promise<void>;
  handleCommand: (command: Command) => Promise<Result>;
  handleQuery:   (query: Query) => Promise<Reply>;
}

export interface Config {
  name:   string;
  Bus:    Bus.Config;
  typers: Typers;
}

export class Service {
  private name:    string;
  private bus:     Bus.Bus;
  private command: Translator<Command, Command>;
  private query:   Translator<Query, Reply>;
  private handler: Handler;

  constructor(config: Config, handler: Handler) {
    this.name    = config.name;
    this.bus     = new Bus.Bus(config.Bus);
    this.command = new Translator(config.typers.Command);
    this.query   = new Translator(config.typers.Query);
    this.handler = handler;
  }

  public async start() {
    if (await this.handler.start()) {
      await this.bus.start();
      this.bus.command.listen(this.name, async (command: InCommand) => {
        const xCommand = <Command>this.command.decode(command);
        const result = await this.handler.handleCommand(xCommand);
        result.commands.forEach((xCommand: Command) => {
          const command = this.command.encode(xCommand);
          const outCommand = new OutCommand(command.key, command.order, command.data, command.meta);
          this.bus.command.request(outCommand);
        });
        command.ack();
        debugger;
      });
      this.bus.query.serve(this.name, async (query: InQuery) => {
        debugger;
        const xQuery = <Query>this.query.decode(query);
        const reply = await this.handler.handleQuery(query);
        console.log(reply);
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
