import * as Component         from './Component';

import { Command, InCommand } from './Command';
import { Reply, Status }      from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Props extends Component.Props {
  size?:    number;
  ttl?:     number;
  timeout?: number;
}

export interface Children extends Component.Children {}

export class Debouncer extends Component.Component {
  private waiting: CachingMap<string, Array<InCommand>>;
  private ttl:     number;
  private timeout: number;

  constructor(props: Props, children: any) {
    super({ type: 'Debouncer', color: 'magenta', ...props }, children);
    this.waiting = new CachingMap(props.size >= 0 ? props.size : null);
    this.ttl     = props.ttl >= 0 ? props.ttl : null;
    this.timeout = (props.timeout > 0 || props.timeout == -1) ? props.timeout : 60000;
  }

  public async satisfy(command: InCommand, handler: (command: Command) => Promise<Reply>): Promise<void> {
    this.logger.log('%red %s : %s %j', 'Command', command.key, command.order, command.data);
    let timer = null;
    if (this.timeout > 0) {
      timer = setTimeout(() => {
        this.logger.warn('Timed out after %s ms', this.timeout);
        command.relocate('timeout');
      }, this.timeout);
    }
    try {
      const reply = await handler(command);
      if (reply instanceof Reply) return command.resolve(reply.data);
      if (reply == null) return command.resolve(null);
      this.logger.error('Expecting a Reply got: %j', reply);
      command.relocate('bad_result');
    } catch (e) {
      this.logger.error('Got exception:', e);
      command.relocate('failure');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

}
