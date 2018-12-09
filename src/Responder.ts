import * as Component from './Component';

import { Command }    from './Command';
import { State }      from './State';
import { Event }      from './Event';
import { Reply }      from './Reply';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Responder extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Responder', color: 'red', ...props }, children);
  }

  public resolve(command: Command, state: State, events: Array<Event>) {
    const method = 'resolve' + command.order;
    if (method in this) {
      let result = null;
      try { result = this[method](command, state, events); }
      catch (e) { return new Reply(String(e)); }
      if (result instanceof Reply) {
        this.logger.log("Resolved %s : %s => %j", command.key, command.order, result.data);
        return result;
      } else {
        this.logger.log("Resolved %s : %s => %j", command.key, command.order, result);
        return new Reply(null, result);
      }
    } else {
      this.logger.log('No resolution for %s : %s', command.key, command.order);
      return new Reply(null, null);
    }
  }

}
