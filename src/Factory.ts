import * as Element    from './Element';
import { state as S }  from './state';
import { event as E }  from './event';

export interface props extends Element.props {
  events?: { [name: string]: { new (data: any): any } };
}

export class Factory extends Element.Element {
  protected events:  { [name: string]: { new (data: any): any } };

  constructor(props: props) {
    super(props);
    this.events  = props.events || {};
  }

  /**************************/

  public apply(state: S, event: E) {
    const revision = state.revision;
    const applier = this[event.name];
    event.data = new this.events[event.name](event.data);
    let newState = state;
    if (applier) {
      this.logger.log('%s apply %s: %j', state.key, event.name, event.data);
      newState = applier.call(this, state, event) || state;
    } else {
      this.logger.warn('%s skip %s: %j', state.key, event.name, event.data);
    }
    newState.revision = event.number;
    return newState;
  }

}
