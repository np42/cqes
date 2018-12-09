import * as Component from './Component';

import { Command }    from './Command';
import { State }      from './State';
import { Reply }      from './Reply';
import { Event }      from './Event';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Reactor extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Reactor', color: 'magenta', ...props }, children);
  }

  public produce(state: State, events: Array<Event>) {
    return events.forEach(event => {
      const method = 'produce' + event.name;
      if (method in this) this[method](state, event);
    });
  }

}
