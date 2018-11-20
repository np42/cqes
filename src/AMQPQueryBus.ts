import { Fx }                       from './Fx';
import { Handler }                  from './CommandBus';
import { QueryBus }                 from './QueryBus';
import { InQuery, OutQuery }        from './Query';
import { Reply, Status, OutReply }  from './Reply';
import { AMQPBus }                  from './AMQPBus';
import { AMQPInQuery, AMQPInReply } from './AMQPQuery';
import { Channel, Message }         from 'amqplib';
import * as uuid                    from 'uuid';

type Session = { expiresAt: number
               , resolve: (value: any) => void
               , reject: (error: any) => void
               };

export interface Config {
  name: string;
  url: string;
};

export class AMQPQueryBus extends AMQPBus implements QueryBus {

  private id:         string;
  private pending:    Map<string, Session>;
  private connected:  boolean;
  private gcInterval: NodeJS.Timer;

  constructor(config: Config) {
    super(config);
    this.id         = config.name + '.Reply.' + uuid.v1();
    this.pending    = new Map();
    this.connected  = false;
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
      this.pending.get(key).reject(new Error('Timed out'));
      this.pending.delete(key);
    }
  }

  private listenReply() {
    this.gcInterval = setInterval(() => this.gc(), 1000);
    this.consume(this.id, async reply => {
      const session = this.pending.get(reply.id);
      if (session == null) return ;
      session[reply.type](reply);
      this.pending.delete(reply.id);
    }, { noAck: true, channel: { prefetch: 100 }, queue: { exclusive: true }, Message: AMQPInReply })
    this.connected = true;
  }

  //--

  public serve(view: string, handler: Handler<InQuery>) {
    const options =
      { Message: AMQPInQuery
      , channel: { prefetech: 10 }
      , reply: (channel: Channel) => (message: Message) => async (method: Status, content: any) => {
          const options = { correlationId: message.properties.correlationId };
          const reply = method == Status.Rejected ? new OutReply(content) : new OutReply(null, content);
          await channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
          channel.ack(message);
        }
      };
    return this.consume(view + '.Query', handler, options);
  }

  public query(request: OutQuery, timeout = 30): Promise<Reply> {
    if (!this.connected) this.listenReply();
    const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: false };
    const promise = new Promise((resolve, reject) => {
      const session = { expiresAt: Date.now() + (timeout * 1000), resolve, reject };
      (<any>options).expiration = String(timeout * 1000);
      this.pending.set(options.correlationId, session);
      this.publish(request.view, request.serialize(), options);
    });
    return <any>promise;
  }

}
