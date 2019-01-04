import * as Component     from './Component';

import { Query, InQuery } from './Query';
import { Reply }          from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Props extends Component.Props {
  ttl?:   number;
}

export interface Children extends Component.Children {}

export class Throttler extends Component.Component {
  private running: CachingMap<string, Array<any>>;
  private ttl:     number;

  constructor(props: Props, children: Children) {
    super({ type: 'Throttler', color: 'cyan', ...props }, children);
    this.running = new CachingMap();
    this.ttl     = props.ttl > 0 ? props.ttl : null;
  }

  public async satisfy(query: InQuery, handler: (query: Query) => Promise<Reply>): Promise<void> {
    this.logger.log('%blue %s -> %s %j', 'Query', query.view, query.method, query.data);
    try {
      const reply = await handler(query);
      if (reply instanceof Reply) return query[reply.status](reply.data);
      this.logger.warn('Expecting a Reply got: %j', reply);
      query.reject(null);
    } catch (e) {
      this.logger.error(e);
      query.reject(e);
    }
  }

}