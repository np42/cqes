import { AMQPBus, FxConnection }    from './AMQPBus';
import { Fx }                       from './Fx';
import { Channel, Message }         from 'amqplib';
import { CommandBus, Handler }      from './CommandBus';
import { InCommand, OutCommand }    from './Command';
import { AMQPInCommand }            from './AMQPCommand';
import { Reply, OutReply }          from './Reply';
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

export enum Status
{ Resolved = 'resolve'
, Rejected = 'reject'
, Relocated = 'relocate'
, Canceled = 'cancel'
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
      this.pending.get(key).resolve(new Reply('Timed out'));
      this.pending.delete(key);
    }
  }

  public async start() {
    super.start();
    this.gcInterval = setInterval(() => this.gc(), 1000);
    this.response = <any>await this.consume(this.id, async (reply: AMQPInReply) => {
      const session = this.pending.get(reply.id);
      if (session == null) return /* FIXME: do not fail silently */;
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

  public listen(topic: string, handler: Handler<InCommand>) {
    const options =
      { Message: AMQPInCommand
      , channel: { prefetch: 10 }
      , reply: (channel: Channel) => (message: Message) => (method: Status, content: any) => {
          const options = { correlationId: message.properties.correlationId };
          switch (method) {
          case Status.Resolved: {
            const reply = new OutReply(null, content);
            channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
            channel.ack(message);
            this.logger.debug('Resolved');
          }; break ;
          case Status.Rejected: {
            const reply = new OutReply(content);
            channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
            channel.reject(message);
            this.logger.debug('Rejected');
          }; break ;
          case Status.Canceled: {
            const reply = new OutReply('Canceled');
            channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
            channel.ack(message);
            this.logger.debug('Canceled');
          }; break ;
          case Status.Relocated: {
            const moveOptions = { ...options, replyTo: message.properties.replyTo };
            const target = message.fields.routingKey + '._' + content;
            channel.ack(message);
            this.publish(target, message.content, moveOptions);
            this.logger.debug('Relocated to %s', target);
          }; break ;
          }
        }
      };
    return this.consume(topic + '.Command', handler, options);
  }

  public async request(request: OutCommand, timeout = 30) {
    const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: true };
    const offset  = request.key.indexOf('-');
    const topic   = offset > 0 ? request.key.substr(0, offset) : request.key;
    const promise = new Promise(resolve => {
      const session = { expiresAt: Date.now() + (timeout * 1000), resolve };
      this.pending.set(options.correlationId, session);
      this.publish(topic + '.Command', request.serialize(), options);
    });
    return <any>promise;
  }

}

