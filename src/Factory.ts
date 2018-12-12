import * as Component  from './Component';

import { Event }       from './Event';
import { State }       from './State';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Factory extends Component.Component {

  constructor(props: Props, children: Children) {
    super({ type: 'Factory', ...props }, children);
  }

  public apply(state: State, events: Array<Event>) {
    const version = state.version;
    const newState = events.reduce((state, event) => {
      const method = 'apply' + event.name;
      if (method in this) return this[method](state, event);
      return state;
    }, state);
    if (newState.version >= 0) {
      const diff = newState.version - version;
      this.logger.log('State %s@%s changed +%s', newState.version, newState.key, diff);
    } else {
      this.logger.log('State %s destroyed', newState.key);
    }
    return newState;
  }

}
