import * as Component  from '../Component';
import * as CommandBus from '../CommandBus';
import { Command }     from '../Command';
import * as amqp       from 'amqplib';
import * as uuid       from 'uuid';

export type commandHandler = (command: Command<any>) => Promise<void>;

export interface props extends Component.props {
  AMQP: { url?: string }
}

export class Transport extends Component.Component implements CommandBus.Transport {
  protected amqp: amqp.Connection;

  constructor(props: props) {
    super(props);
    if (props.AMQP == null)
      props.AMQP = {};
    if (props.AMQP.url == null)
      props.AMQP.url = 'amqp://cqes:changeit@127.0.0.1/cqes-' + props.name.toLowerCase();
    //amqp.connect(props.AMQP.url);
  }

  //--

  public listen(queue: string, handler: commandHandler): Promise<CommandBus.Subscription> {
    /*
    const options = { channel: this.props.consumer.channel, queue: this.props.consumer.queue };
    const queue = [topic, 'command'].join('.');
    return this.amqp.consume(queue, (message: Message) => {
      const payload = JSON.parse(message.content.toString());
      const meta = {};
      Object.defineProperty(meta, 'amqp', { value: message });
      const command = new Command(payload.type, payload.id, payload.order, payload.data, meta)
      command.createdAt = payload.createdAt;
      handler(command);
    }, options);
    */
    return Promise.resolve({ abort: () => Promise.resolve() });
  }

  public send(command: Command<any>): Promise<void> {
    /*
    const options =
      { persistent: true
      , priority: command.meta && command.meta.priority >= 0 ? command.meta.priority : 0
      };
    const promise = new Promise(resolve => {
      const buffer = Buffer.from(JSON.stringify(command));
      this.publish(topic + '.command', buffer, options);
    });
    return <any>promise;
    */
    return Promise.resolve();
  }

}

