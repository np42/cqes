import * as Component from './Component';

import { Command }    from './Command';
import { State }      from './State';
import { Event }      from './Event';
import { Reply }      from './Reply';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Responder extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Responder', ...props }, children);
  }

  public responde(command: Command, state: State, events: Array<Event>) {
    let method = null;
    let result = null;
    const shortMethod = 'responde' + command.order;
    if (shortMethod in this) {
      try { result = this[shortMethod](command, state, events); }
      catch (e) { return new Reply(String(e)); }
      method = shortMethod;
    } else {
      for (const event of events) {
        const longMethod = shortMethod + 'When' + event.name;
        if (!(longMethod in this)) continue ;
        try { result = this[longMethod](command, state, event); }
        catch (e) { return new Reply(String(e)); }
        method = longMethod;
        break ;
      }
    }
    if (result instanceof Reply) {
      this.logger.log("Resolved %s by %s => %j", command.key, method, result.data);
      return result;
    } else if (result != null) {
      this.logger.log("Resolved %s by %s => %j", command.key, method, result);
      return new Reply(null, result);
    } else if (method != null) {
      this.logger.log('No resolution for %s : %s', command.key, command.order);
      return new Reply(null, null);
    } else {
      return new Reply(null, null);
    }
  }

}
