import { Logger } from './Logger';
import { Event }  from './Event';
import { State }  from './State';

export type Handler = (state: State, event: Event) => State;

export class Factory {

  private logger: Logger;
  private handlers: Map<string, Handler>;

  constructor() {
    this.logger = new Logger('Factory', 'green');
    this.handlers = new Map();
  }

  public when(type: string, handler: Handler) {
    this.handlers.set(type, handler);
    return this;
  }

  /******************************/

  public apply(state: State, events: Array<Event>) {
    const handlerAny = this.handlers.get('any');
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
      const handlerNamed = this.handlers.get('on' + event.name);
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