import * as Component from './Component';

import { State }      from './State';
import { Command }    from './Command';
import { Query }      from './Query';
import { Event }      from './Event';
import { Reply }      from './Reply';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Manager extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Manager', color: 'red', ...props }, children);
  }

  public empty(): Array<Event> {
    return [];
  }

  public handle(state: State, command: Command): Promise<Array<Event>> {
    const method = 'handle' + command.order;
    if (method in this) {
      this.logger.log('Handle %s : %s %j', command.key, command.order, command.data);
      return this[method](state, command);
    } else {
      this.logger.log('Skip %s : %s %j', command.key, command.order, command.data);
      return Promise.resolve(this.empty());
    }
  }

}
