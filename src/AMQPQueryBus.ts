import * as AMQPBus                 from './AMQPBus';
import { Fx }                       from './Fx';
import { Channel, Message }         from 'amqplib';
import { QueryBus }                 from './QueryBus';
import { query as Query }           from './query';
import { reply as Reply, Status }   from './reply';
import * as uuid                    from 'uuid';

export interface Config {
  name: string;
  url: string;
}

export interface props extends AMQPBus.props {}

function rand() {
  return process.pid + '.' + Math.floor(Math.random() * 1000);
}

export class AMQPQueryBus extends AMQPBus.AMQPBus {

  private id:         string;
  private response:   AMQPBus.FxConnection;

  constructor(props: AMQPBus.props) {
    super(props);
    this.id       = [this.context, 'reply', rand()].join('.');
    this.response = null;
  }

  public async start() {
    if (this.response != null) return true;
    if (await super.start()) {
      this.response = <any>await this.consume(this.id, async (message: Message) => {
        const payload = JSON.parse(message.content.toString());
        const reply   = new Reply(payload.data);
        reply.status  = payload.status;
        this.props.handler(message.properties.correlationId, reply);
      }, { channel: { prefetch: 100, noAck: true, exclusive: true }
         , queue: { durable: false, exclusive: true }
         }
      );
      return true;
    } else {
      return false;
    }
  }

  //--

  public serve(view: string, handler: (query: Query<any>) => void) {
    const options = { channel: { prefetch: 10 }, queue: { durable: false } };
    const queue = [this.context, view, 'query'].join('.');
    return this.consume(queue, (message: Message) => {
      const payload = JSON.parse(message.content.toString());
      const meta  = {};
      const query = new Query(payload.view, payload.method, payload.data, meta);
      Object.defineProperty(meta, 'amqp', { value: message });
      handler(query);
    }, options);
  }

  public query(request: Query<any>, timeout = 30): Promise<string> {
    const id      = uuid.v4();
    const options = { replyTo: this.id, correlationId: id, persistent: false
                    , channel: { durable: false }
                    };
    const topic   = request.view.split('-').shift();
    return new Promise(resolve => {
      (<any>options).expiration = String(timeout * 1000);
      const payload = Buffer.from(JSON.stringify(request));
      this.publish(topic + '.query', payload, options);
      return resolve(id);
    });
  }

  public async reply(query: Query<any>, reply: Reply<any>): Promise<void> {
    const message = query.meta.amqp;
    if (message == null) return this.logger.error('Unable to reply AMQP Message: not found');
    const payload = Buffer.from(JSON.stringify(reply));
    const options = { correlationId: message.properties.correlationId
                    , channel: { durable: false }
                    };
    return message.channel.sendToQueue(message.properties.replyTo, payload, options);
  }

}
