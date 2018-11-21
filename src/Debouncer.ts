import { Logger }    from './Logger';
import { InCommand } from './Command';
import { Reply }     from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Config {
  name:  string;
  size?: number;
  ttl?:  number;
  did?:  (key: string) => Promise<boolean>;
};

export class Debouncer {

  private logger:  Logger;
  private waiting: CachingMap<string, Array<InCommand>>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Debouncer', 'yellow');
    this.waiting = new CachingMap(config.size >= 0 ? config.size : null);
    this.ttl     = config.ttl >= 0 ? config.ttl : null;
  }

  public async satisfy(command: InCommand, handler: () => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Command %s : %s', command.key, command.order);
    const reply = await handler();
    command[reply.status](reply.data);
  }

}
