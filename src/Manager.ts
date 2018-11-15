import { Logger }  from './Logger';
import { State }   from './State';
import { Command } from './Command';
import { Event }   from './Event';

export type Handler = (state: State, command: Command) => Promise<Array<Event> | Event>;

export type Handlers = { [name: string]: Handler };

export interface Config {
  name: string;
  handlers: Handlers;
};

export class Manager {

  private logger:   Logger;
  private handlers: Handlers;

  constructor(config: Config) {
    this.logger   = new Logger(config.name + '.Manager', 'red');
    this.handlers = config.handlers;
  }

  public async handle(state: State, command: Command): Promise<Array<Event>> {
    const handlerAny   = this.handlers.on;
    const handlerNamed = this.handlers['on' + command.order];
    if (handlerNamed == null && handlerAny == null) {
      this.logger.warn('Missing handler: ', command.order);
      return [];
    } else {
      const result = await (handlerNamed || handlerAny)(state, command);
      if (result == null) return [];
      if (result instanceof Array) return result;
      return [result];
    }
  }

}
