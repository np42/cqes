import { Fx }                                        from './Fx';
import { AMQPBus, MessageHandler, FxMessageHandler } from './AMQPBus';
import { AMQPQuery }                                 from './AMQPQuery';
import { AMQPReply }                                 from './AMQPReply';
import { Query }                                     from './Query';
import { Reply, Type as ReplyType }                  from './Reply';
import { Channel, Message }                          from 'amqplib';
import * as uuid                                     from 'uuid';

type Session = { expiresAt: number
               , resolve: (value: any) => void
               , reject: (error: any) => void
               };

export class AMQPQueryBus extends AMQPBus {

  private id:         string;
  private pending:    Map<string, Session>;
  private queue:      Fx<Channel, AMQPReply>;
  private gcInterval: NodeJS.Timer;

  constructor(url: string) {
    super(url);
    this.id      = 'RPC-' + uuid.v1();
    this.pending = new Map();
    this.queue   = this.consume(this.id, async reply => {
      const session = this.pending.get(reply.id);
      if (session == null) return ;
      session[reply.type](reply);
      this.pending.delete(reply.id);
    }, { channel: { prefetch: 100 }, queue: { exclusive: true }, Message: AMQPReply })
    this.gcInterval = setInterval(() => this.gc(), 1000);
  }

  gc() {
    // FIXME write a better algo
    const expired = [];
    const now = Date.now();
    for (const [key, item] of this.pending) {
      if (item.expiresAt > now) continue ;
      expired.push(key);
    }
    for (const key of expired)
      this.pending.delete(key);
  }

  serve(view: string, handler: MessageHandler | FxMessageHandler) {
    const options =
      { Message: AMQPQuery
      , channel: { prefetech: 10 }
      , reply: (channel: Channel) => (message: Message) => async (method: ReplyType, content: any) => {
          const options = { correlationId: message.properties.correlationId };
          const reply = new Reply(method, content).serialize();
          await channel.sendToQueue(message.properties.replyTo, reply, options);
          channel.ack(message);
        }
      };
    return this.consume(view, handler, options);
  }

  query(request: Query, timeout = 30) {
    const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4() };
    const promise = new Promise((resolve, reject) => {
      const session = { expiresAt: Date.now() + (timeout * 1000), resolve, reject };
      this.pending.set(options.correlationId, session);
      this.publish(request.view, request.serialize(), options);
    });
    return promise;
  }

}
