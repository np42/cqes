import * as Component         from './Component';

import { Command, InCommand } from './Command';
import { Reply }              from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Props extends Component.Props {
  size?:    number;
  ttl?:     number;
}

export interface Children extends Component.Children {}

export class Debouncer extends Component.Component {
  private waiting: CachingMap<string, Array<InCommand>>;
  private ttl:     number;

  constructor(props: Props, children: any) {
    super({ type: 'Debouncer', color: 'magenta', ...props }, children);
    this.waiting = new CachingMap(props.size >= 0 ? props.size : null);
    this.ttl     = props.ttl >= 0 ? props.ttl : null;
  }

  public async satisfy(command: InCommand, handler: (command: Command) => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Command %s : %s', command.key, command.order);
    try {
      const reply = await handler(command);
      if (reply instanceof Reply) return command[reply.status](reply.data);
      this.logger.warn('Expecting a Reply got: %j', reply);
      return command.reject(null);
    } catch (e) {
      this.logger.error(e);
      return command.reject(e);
    }
  }

}
