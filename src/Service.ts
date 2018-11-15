import { Bus }          from './Bus';

import { Command }      from './Command';
import { Query, Reply } from './Query';
import { Event }        from './Event';
import { State }        from './State';

export interface Typer<P, R> {
  from: (input: P) => any;
  to:   (output: any) => R;
}

export interface Typers {
  Command?: Typer<Command, Command>;
  Query?:   Typer<Query, Reply>;
  Event?:   Typer<Event, Event>;
  State?:   Typer<State, State>;
}

export interface Result {
  events: Array<Event>;
  commands: Array<Command>;
};

export interface Handler {
  start: () => Promise<boolean>;
  stop:  () => Promise<void>;
  handleCommand: (command: Command) => Promise<Result>;
  handleQuery:   (query: Query) => Promise<Reply>;
}

export interface Config {
  name: string;
  bus: any;
  typers: Typers;
}

export class Service {
  private bus:     Bus;
  private command: Typer<Command, Command>;
  private query:   Typer<Query, Reply>;
  private event:   Typer<Event, Event>;
  private state:   Typer<State, State>;
  private handler: Handler;

  constructor(config: Config, handler: Handler) {
    this.bus     = new Bus(config.bus);
    this.command = config.typers.Command || new IdentityTyper();
    this.query   = config.typers.Query   || new IdentityTyper();
    this.event   = config.typers.Event   || new IdentityTyper();
    this.state   = config.typers.State   || new IdentityTyper();
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

class IdentityTyper implements Typer<any, any> {
  from(value: any) { return value };
  to(value: any)   { return value };
}
