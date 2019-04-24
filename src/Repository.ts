import * as Gateway from './Gateway';
import { deserialize } from "serializer.ts/Serializer";

import { query as Q } from './query';
import { reply as R } from './reply';

export interface props    extends Gateway.props {
  queries?: { [name: string]: { new (data: any): any } }
  replies?: { [name: string]: { new (data: any): any } }
}
export interface children extends Gateway.children {}

export class Repository extends Gateway.Gateway {
  protected queries: { [name: string]: { new (data: any): any } };
  protected replies: { [name: string]: { new (data: any): any } };

  constructor(props: props, children: children) {
    super({ type: 'repository', color: 'cyan', ...props }, children);
    this.queries = props.queries || {};
    this.replies = props.replies || {};
  }

  public async start() {
    this.bus.query.serve(this.name, async query => {
      const qtype = this.queries[query.view];
      if (qtype == null) {
        this.logger.error('No type for %j', query);
        const reply = new R('Error', new Error('Query type is missing'));
        return this.bus.query.reply(query, reply);
      } else {
        query.data = deserialize(qtype, query.data);
        const reply = await this.resolve(query);
        return this.bus.query.reply(query, reply);
      }
    });
    return super.start();
  }

  public async resolve(query: Q): Promise<R> {
    const method = 'resolve' + query.method;
    if (method in this) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      try {
        const reply = await this[method](query);
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
