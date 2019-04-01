import * as Component from './Component';
import * as Bus         from './Bus';

import { command }    from './command';
import { state }      from './state';
import { reply }      from './reply';
import { event }      from './event';

export interface props extends Component.props {}

export interface children extends Component.children {}

export class Reactor extends Component.Component {
  protected bus: Bus.Bus;

  constructor(props: props, children: children) {
    super({ type: 'Reactor', ...props }, children);
    this.bus = props.bus;
  }

  public on(state: state<any>) {
    if (state.events == null) return ;
    return state.events.forEach(event => {
      const method = 'on' + event.name;
      if (method in this) this[method](state, event);
    });
  }

}
