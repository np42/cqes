import { AMQPBus, FxConnection }    from './AMQPBus';
import { Fx }                       from './Fx';
import { Channel, Message }         from 'amqplib';
import { QueryBus }                 from './QueryBus';
import { Handler }                  from './CommandBus';
import { InQuery, OutQuery }        from './Query';
import { AMQPInQuery }              from './AMQPQuery';
import { Reply, Status, OutReply }  from './Reply';
import { AMQPInReply }              from './AMQPReply';
import * as uuid                    from 'uuid';

interface Session {
  expiresAt: number;
  resolve: (value: any) => void;
};

export interface Config {
  name: string;
  url: string;
};

export class AMQPQueryBus extends AMQPBus implements QueryBus {

  private id:         string;
  private pending:    Map<string, Session>;
  private response:   FxConnection;
  private gcInterval: NodeJS.Timer;

  constructor(config: Config) {
    super(config);
    this.id         = config.name + '.Reply.' + uuid.v1();
    this.pending    = new Map();
    this.response = null;
    this.gcInterval = null;
  }

  private gc() {
    // FIXME write a better algo
    const expired = [];
    const now = Date.now();
    for (const [key, item] of this.pending) {
      if (item.expiresAt > now) continue ;
      expired.push(key);
    }
    for (const key of expired) {
      this.pending.get(key).resolve(new Reply('Timed out'));
      this.pending.delete(key);
    }
  }

  public async start() {
    super.start();
    this.gcInterval = setInterval(() => this.gc(), 1000);
    this.response = <any>await this.consume(this.id, async (reply: AMQPInReply) => {
      const session = this.pending.get(reply.id);
      if (session == null) return  /* FIXME: do not fail silently */;
      session.resolve(reply);
      this.pending.delete(reply.id);
    }, { noAck: true
       , channel: { prefetch: 100 }
       , queue: { exclusive: true, durable: false }
       , Message: AMQPInReply
       }
    );
    return true;
  }

  //--

  public serve(view: string, handler: Handler<InQuery>) {
    const options =
      { Message: AMQPInQuery
      , channel: { prefetch: 10 }
      , reply: (channel: Channel) => (message: Message) => (method: Status, content: any) => {
          const options = { correlationId: message.properties.correlationId };
          const reply = method == Status.Rejected ? new OutReply(content) : new OutReply(null, content);
          channel.sendToQueue(message.properties.replyTo, reply.serialize(), options)
          channel.ack(message);
        }
      };
    return this.consume(view + '.Query', handler, options);
  }

  public query(request: OutQuery, timeout = 30): Promise<Reply> {
    const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: false };
    const offset  = request.view.indexOf('-');
    const topic   = offset > 0 ? request.view.substr(0, offset) : request.view;
    const promise = new Promise(resolve => {
      const session = { expiresAt: Date.now() + (timeout * 1000), resolve };
      (<any>options).expiration = String(timeout * 1000);
      this.pending.set(options.correlationId, session);
      this.publish(topic + '.Query', request.serialize(), options);
    });
    return <any>promise;
  }

}
