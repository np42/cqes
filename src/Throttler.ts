import { Logger }         from './Logger';
import { Translator }     from './Translator';
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
  Query?: Translator<Query>;
  Reply?: Translator<Reply>;
};

export class Throttler {

  private logger:  Logger;
  private running: CachingMap<string, Array<any>>;
  private query:   Translator<Query>;
  private reply:   Translator<Reply>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Throttler', 'cyan');
    this.running = new CachingMap();
    this.query   = new Translator(config.Query);
    this.reply   = new Translator(config.Reply);
    this.ttl     = config.ttl > 0 ? config.ttl : null;
  }

  public async satisfy(query: InQuery, handler: (query: Query) => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Query %s->%s', query.view, query.method);
    const xQuery = <Query>this.query.decode(query);
    const xReply = await handler(query);
    const reply = <Reply>this.reply.encode(xReply);
    query[reply.status](reply.data);
  }

}