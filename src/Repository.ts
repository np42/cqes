import * as Component   from './Component';

import { Query }        from './Query';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Repository extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Repository', color: 'blue', ...props }, children);
  }

  public start(): Promise<boolean> {
    this.logger.log('Starting');
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    this.logger.log('Stoping');
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

  public handleQuery(query: Query): Promise<Reply> {
    const method = 'query' + query.method;
    if (method in this) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      return this[method](query);
    } else {
      this.logger.log('Ignoring %s -> %s', query.view, query.method);
      return Promise.resolve(new Reply(null, null));
    }
  }

}
