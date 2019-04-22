import * as Service from './Service';

import { state }    from './state';
import { command }  from './command';
import { query }    from './query';
import { reply }    from './reply';
import { event }    from './event';

export interface props extends Service.props {}
export interface children extends Service.children {}

export class CommandHandler extends Service.Service {
  static noop(): Array<event<any>> {
    return [];
  }

  constructor(props: props, children: children) {
    super({ ...props, type: 'command-handler', color: 'magenta' }, children);
  }

  public async start() {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    const topics = this.props.topics || [this.name];
    topics.forEach((topic: string) => {
      this.bus.command.listen(topic, async command => {
        debugger;
      });
    });
    this.bus.event.psubscribe(this.name, this.context, async event => {
      debugger;
    });
    return super.start();
  }

  public async handle(state: state<any>, command: command<any>): Promise<Array<event<any>>> {
    const method = 'handle' + command.order;
    if (method in this) {
      this.logger.debug('Handle %s : %s %j', command.id, command.order, command.data);
      const result = await this[method](state, command);
      if (result instanceof Array) return result;
      if (result instanceof event) return [result];
      return CommandHandler.noop();
    } else {
      this.logger.log('Skip %s : %s %j', command.id, command.order, command.data);
      return CommandHandler.noop();
    }
  }

}
