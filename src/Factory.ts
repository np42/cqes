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
      if (method in this) return this[method](state, event) || state;
      return state;
    }, state);
    if (newState.version >= 0) {
      const diff = newState.version - version;
      if (diff === 0) {
        this.logger.debug('State %s@%s not changed', newState.version, newState.key);
      } else {
        this.logger.debug('State %s@%s changed +%s', newState.version, newState.key, diff);
      }
    } else {
      this.logger.debug('State %s destroyed', newState.key);
    }
    return newState;
  }

}
