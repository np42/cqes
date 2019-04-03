import * as Component from './Component';
import * as Bus       from './Bus';

import { state }      from './state';
import { command }    from './command';
import { query }      from './query';
import { reply }      from './reply';
import { event }      from './event';

export interface props extends Component.props {
  bus: Bus.Bus;
}

export interface children extends Component.children {}

export class CommandHandler extends Component.Component {
  protected bus: Bus.Bus;

  constructor(props: props, children: children) {
    super({ ...props, type: props.type + '.command-handler', color: 'red' }, children);
    this.bus = props.bus;
  }

  public noop(): Array<event<any>> {
    return [];
  }

  public handle(state: state<any>, command: command<any>): Promise<Array<event<any>>> {
    const method = 'handle' + command.order;
    if (method in this) {
      this.logger.debug('Handle %s : %s %j', command.id, command.order, command.data);
      return this[method](state, command);
    } else {
      this.logger.log('Skip %s : %s %j', command.id, command.order, command.data);
      return Promise.resolve(this.noop());
    }
  }

}
