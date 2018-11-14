import * as Facet       from './Facet';

import { Bus }          from './Bus';

import { Command }      from './Command';
import { Query, Reply } from './Query';

export interface Config {
  name: string;
  bus: any;
}

export interface Typer {
  Command?: Facet.Command;
  Query?:   Facet.Query;
  Event?:   Facet.Event;
  State?:   Facet.State;
}

export interface Handler {
  start: () => Promise<boolean>;
  stop:  () => Promise<void>;
  handleCommand: (command: Command) => Promise<{ events: Array<Event>, commands: Array<Command> }>;
  handleQuery:   (query: Query) => Promise<Reply>;
}

class IdentityTyper {
  fromJs(value: any) { return value };
  toJs(value: any)   { return value };
}

export class Service {
  private bus:     Bus;
  private command: Facet.Command;
  private query:   Facet.Query;
  private event:   Facet.Event;
  private state:   Facet.State;
  private handler: Handler;

  constructor(config: Config, typer: Typer, handler: Handler) {
    this.bus     = new Bus(config.bus);
    this.command = typer.Command || new IdentityTyper();
    this.query   = typer.Query   || new IdentityTyper();
    this.event   = typer.Event   || new IdentityTyper();
    this.state   = typer.State   || new IdentityTyper();
    this.handler = handler;
  }

  public async start() {
    if (await this.handler.start()) {
      this.bus.start();
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
