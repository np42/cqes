import { Logger }    from './Logger';

import { InQuery }   from './Query';
import { Reply }     from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Config {
  name: string;
  ttl?: number;
};

export class Throttler {

  private logger:  Logger;
  private running: CachingMap<string, Array<any>>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Throttler', 'yellow');
    this.running = new CachingMap();
    this.ttl     = config.ttl > 0 ? config.ttl : null;
  }

  public async satisfy(command: InQuery, handler: () => Promise<Reply>): Promise<void> {
    const reply = await handler();
    debugger;
    //command.ack(reply);
  }

}