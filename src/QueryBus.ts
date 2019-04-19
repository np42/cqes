import * as Component         from './Component';
import { query as Query }     from './query';
import { reply as Reply }     from './reply';
import * as AMQPQueryBus    from './AMQPQueryBus';

interface Session {
  expiresAt: number;
  resolve: (value: any) => void;
}

export interface props extends Component.props {
  AMQP?: AMQPQueryBus.props
}
export interface children extends Component.children {}

export class QueryBus extends Component.Component {
  private   pending:    Map<string, Session>;
  private   gcInterval: NodeJS.Timer;
  protected shared:     void; // TODO
  protected pipe:       void; // TODO
  protected amqp:       AMQPQueryBus.AMQPQueryBus;

  constructor(props: props, children: children) {
    super(props, children);
    this.gcInterval = null;
    this.pending    = new Map();
    const handler   = (id: string, reply: Reply<any>) => this.handleReply(id, reply);
    this.amqp       = new AMQPQueryBus.AMQPQueryBus({ ...props, ...props.AMQP, handler });
  }

  public serve(view: string, handler: (query: Query<any>) => void): boolean {
    this.logger.log('%blue %s', 'Serve', view);
    this.amqp.serve(view, handler);
    return true;
  }

  public async request(view: string, method: string, data: any, meta?: any): Promise<Reply<any>> {
    const request = new Query(view, method, data, meta);
    const timeout = 30;
    this.logger.log('%blue %s -> %s %j', 'Query', view, method, data);
    const id = await this.amqp.query(request, timeout);
    return new Promise(resolve => {
      this.pending.set(id, { resolve, expiresAt: Date.now() + (timeout * 1000) });
    });
  }

  public reply(query: Query<any>, reply: Reply<any>): Promise<void> {
    this.logger.log('%blue [%s] %s %j', 'Reply', query.view, reply.status, reply.data);
    return this.amqp.reply(query, reply);
  }

  public handleReply(id: string, reply: Reply<any>) {
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
      this.pending.get(key).resolve(new Reply(null, 'Timed out'));
      this.pending.delete(key);
    }
  }

  public start(): Promise<boolean> {
    this.gcInterval = setInterval(() => this.gc(), 1000);
    return this.amqp.start();
  }

  public stop(): Promise<void> {
    return this.amqp.stop();
  }

}
