import * as Component  from './Component';

import { Event }       from './Event';
import { State }       from './State';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Factory extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Factory', color: 'green', ...props }, children);
  }

  public apply(state: State, events: Array<Event>) {
    const version = state.version;
    const newState = events.reduce((state, event) => {
      const method = 'apply' + event.name;
      if (method in this) return this[method](state, event);
      return state;
    }, state);
    const diff = newState.version - version;
    this.logger.log('State changed +%s -> %s', diff, newState.version);
    return newState;
  }

}
