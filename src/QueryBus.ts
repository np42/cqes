import * as Element         from './Element';
import { query as Q }       from './query';
import { reply as R }       from './reply';
import * as AMQPQueryBus    from './AMQPQueryBus';

interface Session {
  expiresAt: number;
  resolve: (value: any) => void;
}

export interface props extends Element.props {
  AMQP?: AMQPQueryBus.props
}

export class QueryBus extends Element.Element {
  protected context:    string;
  private   pending:    Map<string, Session>;
  private   gcInterval: NodeJS.Timer;
  protected amqp:       AMQPQueryBus.AMQPQueryBus;

  constructor(props: props) {
    super(props);
    this.context     = props.context;
    this.gcInterval  = null;
    this.pending     = new Map();
    const handler    = (id: string, reply: R) => this.handleReply(id, reply);
    const childProps = { context: props.context, logger: props.logger }
    this.amqp        = new AMQPQueryBus.AMQPQueryBus({ ...childProps, handler, ...props.AMQP });
  }

  public serve(view: string, handler: (query: Q) => void): boolean {
    this.logger.log('%blue %s', 'Serve', view);
    this.amqp.serve(view, handler);
    return true;
  }

  public async request(view: string, method: string, data: any, meta?: any): Promise<R> {
    const request = new Q(view, method, data, meta);
    const timeout = 30;
    this.logger.log('%blue %s -> %s %j', 'Query', view, method, data);
    const id = await this.amqp.query(request, timeout);
    return new Promise(resolve => {
      this.pending.set(id, { resolve, expiresAt: Date.now() + (timeout * 1000) });
    });
  }

  public reply(query: Q, reply: R): Promise<void> {
    if (/Error$/.test(reply.type)) {
      this.logger.error('%blue [%s] %s %j', 'Reply', query.view, reply.type, reply.data);
    } else {
      this.logger.log('%blue [%s] %s %j', 'Reply', query.view, reply.type, reply.data);
    }
    return this.amqp.reply(query, reply);
  }

  public handleReply(id: string, reply: R) {
    const session = this.pending.get(id);
    if (session == null) return this.logger.warn('Reply lost: %j', reply);
    this.pending.delete(id);
    session.resolve(reply);
  }

  //--

  private gc() {
    // FIXME write a better algo
    const expired = [];
    const now = Date.now();
    for (const [key, item] of this.pending) {
      if (item.expiresAt > now) continue ;
      expired.push(key);
    }
    for (const key of expired) {
      this.pending.get(key).resolve(new R('Error', new Error('Timed out')));
      this.pending.delete(key);
    }
  }

  public start(): Promise<boolean> {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    this.gcInterval = setInterval(() => this.gc(), 1000);
    return this.amqp.start();
  }

  public stop(): Promise<void> {
    return this.amqp.stop();
  }

}
