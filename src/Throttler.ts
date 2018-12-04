import { Logger }         from './Logger';
import { Query, InQuery } from './Query';
import { Reply }          from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Config {
  name:   string;
  ttl?:   number;
};

export class Throttler {

  private logger:  Logger;
  private running: CachingMap<string, Array<any>>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Throttler', 'cyan');
    this.running = new CachingMap();
    this.ttl     = config.ttl > 0 ? config.ttl : null;
  }

  public async satisfy(query: InQuery, handler: (query: Query) => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Query %s -> %s', query.view, query.method);
    try {
      const reply = await handler(query);
      if (reply instanceof Reply) return query[reply.status](reply.data);
      this.logger.warn('Expecting a Reply got: %j', reply);
      return query.reject(null);
    } catch (e) {
      this.logger.error(e);
      return query.reject(e);
    }
  }

}