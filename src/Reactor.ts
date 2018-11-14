import { Logger } from './Logger';

import { Command } from './Command';
import { State }   from './State';
import { Event }   from './Event';

export type Config = { name: string };

export type Handler  = (state: any, event: any) => Command | Array<Command>;
export type Handlers = { [name: string]: Handler };

export class Reactor {

  private logger: Logger;
  private handlers: Map<string, Array<Handler>>;

  constructor(config: Config, handlers: Handlers) {
    this.logger   = new Logger(config.name + '.Reactor', 'magenta');
    this.handlers = handlers;
  }

  public handle(state: State, event: Event) {
    const commands = [];
    const handlersAny   = this.handlers.get('any') || [];
    const handlersNamed = this.handlers.get('on' + event.name) || [];
    const handlers = hanldersAny.concat(hanldersNamed);
    for (let i = 0; i < handlers.length; i += 1) {
      const result = handlers[i](state.data, event.data);
      if (result == null) continue ;
      else if (result instanceof Command) commands.push(result);
      else if (result instanceof Array) Array.prototype.push.apply(commands, result);
    }
    return commands;
  }

}
