import { AMQPBus } from './AMQPBus';
import * as uuid   from 'uuid';

export class AMQPQueryBus extends AMQPBus {

  constructor(url) {
    super(url);
    this.id      = 'RPC-' + uuid.v1();
    this.pending = new Map();
    this.queue   = this.consume(this.id, reply => {
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

  serve(view, handler) {
    const options = { Message: AMQPQuery, channel: { prefetech: 10 } };
    options.reply = channel => message => async (method, content) => {
      const options = { correlationId: message.properties.correlationId };
      const reply = new Reply(method, content).serialize();
      await channel.sendToQueue(message.properties.replyTo, reply, options);
      channel.ack(message);
    };
    return this.consume(view, handler, options);
  }

  query(request, timeout = 30) {
    const options = { queue: this.id };
    options.replyTo = this.id;
    options.correlationId = uuid.v4();
    const promise = new Promise((resolve, reject) => {
      const session = { expires: Date.now() + (timeout * 1000), resolve, reject };
      this.pending.set(options.correlationId, session);
      this.publish(request.viewId, request.serialize(), options);
    });
    return promise;
  }

}
