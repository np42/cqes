import * as Service from './Service';

import { command }  from './command';
import { state }    from './state';
import { reply }    from './reply';
import { event }    from './event';

export interface props extends Service.props {}
export interface children extends Service.children {}

export class Reactor extends Service.Service {
  constructor(props: props, children: children) {
    super({ ...props, type: props.type + '.reactor', color: 'magenta' }, children);
  }

  public async start() {
    this.bus.event.psubscribe(this.name, this.context, async event => {
      debugger;
    });
    return super.start();
  }

  public on(state: state<any>) {
    if (state.events == null) return ;
    return state.events.forEach(event => {
      const method = 'on' + event.name;
      if (method in this) this[method](state, event);
    });
  }
}
