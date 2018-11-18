import { Logger } from './Logger';

import { Command } from './Command';
import { State }   from './State';
import { Event }   from './Event';

export type Handler  = (state: any, event: any) => Command | Array<Command>;

export type Handlers = { [name: string]: Handler };

export interface Config {
  name: string;
  handlers: Handlers;
  produce?: (state: State, events: any) => Array<Command>;
};


export interface Reactor {
  produce(state: State, events: any): Array<Command>;
}

export class Reactor {

  private logger:   Logger;
  private handlers: Handlers;

  constructor(config: Config) {
    this.logger   = new Logger(config.name + '.Reactor', 'magenta');
    this.handlers = config.handlers;
    if (config.produce != null)
      this.produce = config.produce;
  }

  public produce(state: State, events: Array<Event>) {
    return events.reduce((commands, event) => {
      return commands.concat(this.produceOne(state, event));
    }, []);
  }

  private produceOne(state: State, event: Event) {
    return ['on', 'on' + event.name].reduce((commands, name) => {
      const handler = this.handlers[name];
      if (handler != null) {
        const result = handler(state, event);
        if (result == null) return commands;
        if (result instanceof Array) Array.prototype.push.apply(commands, result);
        else commands.push(result);
      }
      return commands;
    }, []);
  }

}
