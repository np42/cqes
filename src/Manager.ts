import { Logger }  from './Logger';
import { State }   from './State';
import { Command } from './Command';
import { Event }   from './Event';

export type Config   = { name: string };
export type Handler  = (state: State, command: Command) => Promise<Array<Event> | Event>;
export type Handlers = { [name: string]: Handler };

export class Manager {

  private logger:   Logger;
  private handlers: Handlers;

  constructor(config: Config, handlers: Handlers) {
    this.logger   = new Logger(config.name + '.Manager', 'red');
    this.handlers = handlers;
  }

  public handle(state: State, command: Command): Promise<Array<Event>> {
    const handlerAny   = this.handlers.get('any');
    const handlerNamed = this.handlers.get('on' + order);
    if (handlerNamed == null && handlerAny == null)
      return this.logger.warn('Missing handler: ', order), null;
    const result = (handlerNamed || handlerAny)(state, command);
    if (result == null) return [];
    if (result instanceof Array) return result;
    return [result];
  }

}
