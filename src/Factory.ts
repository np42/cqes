import { Logger } from './Logger';
import { Event }  from './Event';
import { State }  from './State';

export type Handler = (state: State, event: Event) => State;

export interface Config {
  name: string;
  apply?: (state: State, events: any) => State;
}

export class Factory {

  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Factory', 'green');
    this.config = config;
  }

  public apply(state: State, events: Array<Event>) {
    if (this.config.apply != null) {
      const newState = this.config.apply(state, events) || state;
      const diff = newState.version - state.version;
      if (state.version < newState.version)
        this.logger.log('State changed +%s -> %s', diff, newState.version);
      return newState;
    } else {
      return state;
    }
  }

}
