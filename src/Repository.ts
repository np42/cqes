import * as Gateway     from './Gateway';

import { Query }        from './Query';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Props extends Gateway.Props {}

export interface Children extends Gateway.Children {}

export class Repository extends Gateway.Gateway {

  constructor(props: Props, children: Children) {
    super({ type: 'Repository', color: 'blue', ...props }, children);
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public save(state: State, events: Array<Event>): Promise<void> {
    const method = 'save' + state.status;
    if (method in this) {
      this.logger.log('Saving %s@%s -> %s', state.version, state.key, state.status);
      return this[method](state, events);
    } else {
      return Promise.resolve();
    }
  }

  public load(key: string): Promise<State> {
    return Promise.resolve(new State(key));
  }

  public resolve(query: Query): Promise<Reply> {
    const method = 'resolve' + query.method;
    if (method in this) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      return this[method](query);
    } else {
      this.logger.log('Ignoring %s -> %s', query.view, query.method);
      return Promise.resolve(new Reply(null, null));
    }
  }

}
