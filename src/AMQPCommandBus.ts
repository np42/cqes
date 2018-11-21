import { AMQPBus, FxConnection }    from './AMQPBus';
import { Fx }                       from './Fx';
import { Channel, Message }         from 'amqplib';
import { CommandBus, Handler }      from './CommandBus';
import { InCommand, OutCommand }    from './Command';
import { AMQPInCommand }            from './AMQPCommand';
import { Reply, Status, OutReply }  from './Reply';
import { AMQPInReply }              from './AMQPReply';
import * as uuid                    from 'uuid';

interface Session {
  expiresAt: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
};

export interface Config {
  name: string;
  url: string;
};

export class AMQPCommandBus extends AMQPBus implements CommandBus {

  private id:         string;
  private pending:    Map<string, Session>;
  private response:   FxConnection;
  private gcInterval: NodeJS.Timer;

  constructor(config: Config) {
    super(config);
    this.id         = config.name + '.Result.' + uuid.v1();
    this.pending    = new Map();
    this.response   = null;
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

  public async start() {
    super.start();
    this.gcInterval = setInterval(() => this.gc(), 1000);
    this.response = <any>await this.consume(this.id, async (reply: AMQPInReply) => {
      const session = this.pending.get(reply.id);
      if (session == null) return /* FIXME: do not fail silently */;
      session[reply.status](reply);
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

  public listen(topic: string, handler: Handler<InCommand>) {
    const options =
      { Message: AMQPInCommand
      , channel: { prefetch: 10 }
      , reply: (channel: Channel) => (message: Message) => async (method: Status, content: any) => {
          const options = { correlationId: message.properties.correlationId };
          const reply = method == Status.Rejected ? new OutReply(content) : new OutReply(null, content);
          await channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
          channel.ack(message);
        }
      };
    return this.consume(topic + '.Command', handler, options);
  }

  public async request(request: OutCommand, timeout = 30) {
    const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: true };
    const offset  = request.key.indexOf('-');
    const topic   = offset > 0 ? request.key.substr(0, offset) : request.key;
    const promise = new Promise((resolve, reject) => {
      const session = { expiresAt: Date.now() + (timeout * 1000), resolve, reject };
      this.pending.set(options.correlationId, session);
      this.publish(topic + '.Command', request.serialize(), options);
    });
    return <any>promise;
  }

}

