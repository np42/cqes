import { command as Command }       from './command';
import * as AMQPBus                 from './AMQPBus';
import { Channel, Message }         from 'amqplib';
import * as uuid                    from 'uuid';

export interface props extends AMQPBus.props {}
//export interface children extends AMQPBus.children {}

export class AMQPCommandBus extends AMQPBus.AMQPBus {

  constructor(props: props) {
    super({ ...props, type: props.type + '.command' });
  }

  public async start() {
    super.start();
    return true;
  }

  //--

  public listen(topic: string, handler: (command: Command<any>) => void) {
    const options =
      { channel: this.props.consumer.channel
      , queue: this.props.consumer.queue
      };
    return this.consume(topic + '.command', (message: Message) => {
      const payload = JSON.parse(message.content.toString());
      const meta = {};
      Object.defineProperty(meta, 'amqp', { value: message });
      const command = new Command(payload.type, payload.id, payload.order, payload.data, meta)
      command.createdAt = payload.createdAt;
      handler(command);
    }, options);
  }

  public async send(topic: string, command: Command<any>) {
    const options =
      { persistent: true
      , priority: command.meta && command.meta.priority >= 0 ? command.meta.priority : 0
      };
    const promise = new Promise(resolve => {
      const buffer = Buffer.from(JSON.stringify(command));
      this.publish(topic + '.command', buffer, options);
    });
    return <any>promise;
  }

  public async ack(command: Command<any>) {
    const message = command.meta.amqp;
    if (message == null) return this.logger.error('Unable to ack AMQP Message: not found');
    message.channel.ack(message);
  }

}

