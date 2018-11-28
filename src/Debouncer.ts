import { Logger }             from './Logger';
import { Command, InCommand } from './Command';
import { Reply }              from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Config {
  name:     string;
  size?:    number;
  ttl?:     number;
};

export class Debouncer {

  private logger:  Logger;
  private waiting: CachingMap<string, Array<InCommand>>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Debouncer', 'magenta');
    this.waiting = new CachingMap(config.size >= 0 ? config.size : null);
    this.ttl     = config.ttl >= 0 ? config.ttl : null;
  }

  public async satisfy(command: InCommand, handler: (command: Command) => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Command %s : %s', command.key, command.order);
    const reply   = await handler(command);
    if (reply == null) return command.reject(null);
    command[reply.status](reply.data);
  }

}
