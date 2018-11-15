import { Logger } from './Logger';
import { Event }  from './Event';
import { State }  from './State';

export type Handler = (state: State, event: Event) => State;

export type Handlers = { [name: string]: Handler };

export interface Config {
  name: string;
  handlers: Handlers;
}

export class Factory {

  private logger: Logger;
  private handlers: Handlers;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Factory', 'green');
    this.handlers = config.handlers;
  }

  public apply(state: State, events: Array<Event>) {
    const handlerAny = this.handlers.on;
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      let version = state.version;
      if (handlerAny != null) {
        const result = handlerAny(state, event);
        if (result != null) {
          state = result;
          version = state.version = version + 1;
        }
      }
      const handlerNamed = this.handlers['on' + event.name];
      if (handlerNamed != null) {
        const result = handlerNamed(state, event);
        if (result != null) {
          state = result;
          version = state.version = version + 1;
        }
      } else if (handlerAny == null) {
        this.logger.warn('Missing handler: ', name);
        continue ;
      }
    }
    return state;
  }

}