import { Logger } from './Logger';

import { Command } from './Command';
import { State }   from './State';
import { Event }   from './Event';
import { Reply }   from './Reply';

export type Handler  = (command: Command, state: State, events: any) => Reply;

export type Handlers = { [name: string]: Handler };

export interface Config {
  name:      string;
  handlers?: Handlers;
  produce?:  (command: Command, state: State, events: any) => Reply;
};

export interface Responder {
  produce(command: Command, state: State, events: any): Reply;
};

export class Responder {

  private logger:   Logger;
  private handlers: Handlers;

  constructor(config: Config) {
    this.logger   = new Logger(config.name + '.Reactor', 'red');
    this.handlers = config.handlers;
    if (config.produce != null)
      this.produce = config.produce;
  }

  // @override
  public produce(command: Command, state: State, events: Array<Event>) {
    const handler = this.handlers[command.order];
    if (handler != null) return handler(command, state, events);
    return null;
  }

}
