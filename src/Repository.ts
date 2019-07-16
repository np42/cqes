import * as Gateway from './Gateway';

import { query as Q } from './query';
import { reply as R } from './reply';

export interface props extends Gateway.props {
  queries?: { [name: string]: { new (data: any): any } }
  replies?: { [name: string]: { new (data: any): any } }
}

export class Repository extends Gateway.Gateway {
  protected queries: { [name: string]: { new (data: any): any } };
  protected replies: { [name: string]: { new (data: any): any } };

  constructor(props: props) {
    super(props);
    this.queries = props.queries || {};
    this.replies = props.replies || {};
  }

  public async start() {
    this.bus.query.serve(this.context + '.' + this.module, async query => {
      const qtype = this.queries[query.method];
      if (qtype == null) {
        this.logger.error('No type for %j', query);
        const reply = new R('Error', new Error('Query type is missing'));
        return this.bus.query.reply(query, reply);
      } else {
        query.data = new qtype(query.data);
        const reply = await this.resolve(query);
        return this.bus.query.reply(query, reply);
      }
    });
    return super.start();
  }

  public async resolve(query: Q): Promise<R> {
    if (query.method in this) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      try {
        const reply = await this[query.method](query);
        if (reply instanceof R) return reply;
        return new R(reply.constructor.name, reply);
      } catch (error) {
        if (error instanceof R) return error;
        return new R(error.constructor.name, error);
      }
    } else {
      this.logger.log('Ignoring %s -> %s', query.view, query.method);
      return new R('Error', new Error('ignored'));
    }
  }

}
