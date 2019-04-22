import * as Component  from './Component';

import { event }       from './event';
import { state }       from './state';

export interface props extends Component.props {}

export interface children extends Component.children {}

export class Factory extends Component.Component {
  public revisions: Map<string, number>;

  constructor(props: props, children: children) {
    super({ ...props, type: props.type + '.factory', color: 'green' }, children);
  }

  public apply(state: state<any>, event: event<any>) {
    const revision = state.revision;
    const method = 'apply' + event.name;
    const applier = this.getEventApplier(method, event);
    let newState = state;
    if (applier) {
      this.logger.log('%s apply %s: %j', state.key, event.name, event.data);
      newState = applier.call(this, state, event) || state;
    } else {
      this.logger.warn('%s skip %s: %j', state.key, event.name, event.data);
    }
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
    return newState;
  }

  protected getEventApplier(name: string, event: event<any>) {
    return this[name];
  }

}
