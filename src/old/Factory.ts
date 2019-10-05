import * as Component   from './Component';
import { EventBus }     from './EventBus';
import { StateBus }     from './StateBus';
import { State as S }   from './State';
import { Event as E }   from './Event';
const  CachingMap       = require('caching-map');

export type ApplyHandler = (state: S, event: E) => S;

export interface props extends Component.props {
  eHandlers:  { [name: string]: ApplyHandler };
  eBus:       EventBus;
  cacheSize?: number;
}

export class Factory extends Component.Component {
  protected eBus:      EventBus;
  protected sBus:      StateBus;
  protected states:    Map<string, S>;
  protected eHandlers: { [name: string]: ApplyHandler }

  constructor(props: props) {
    super(props);
    this.states    = new CachingMap({ size: props.cacheSize || 1000 });
    this.eHandlers = props.eHandlers || {};
  }

}
