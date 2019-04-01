import * as Component  from './Component';

import { event }       from './event';
import { state }       from './state';

export interface props extends Component.props {}

export interface children extends Component.children {}

export class Factory extends Component.Component {

  constructor(props: props, children: children) {
    super({ type: 'Factory', ...props }, children);
  }

  public apply(state: state<any>, events: Array<event<any>>) {
    const revision = state.revision;
    const newState = events.reduce((state, event) => {
      const method = 'apply' + event.name;
      if (method in this) {
        this.logger.log('%s apply %s: %j', state.key, event.name, event.data);
        return this[method](state, event) || state;
      } else {
        this.logger.warn('%s skip %s: %j', state.key, event.name, event.data);
        return state;
      }
    }, state);
    if (newState.revision >= 0) {
      const diff = newState.revision - revision;
      if (diff === 0) {
        this.logger.debug('State %s@%s not changed', newState.revision, newState.key);
      } else {
        this.logger.debug('State %s@%s changed +%s', newState.revision, newState.key, diff);
      }
    } else {
      this.logger.debug('State %s destroyed', newState.key);
    }
    newState.events = events;
    return newState;
  }

}
