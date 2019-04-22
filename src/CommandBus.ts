import * as Component         from './Component';
import { command as Command } from './command';
import * as AMQPCommandBus    from './AMQPCommandBus';
import { v4 as uuid }         from 'uuid';

export interface props extends Component.props {
  AMQP?: AMQPCommandBus.props
}
export interface children extends Component.children {}

export class CommandBus extends Component.Component {
  protected amqp:   AMQPCommandBus.AMQPCommandBus;

  constructor(props: props, children: children) {
    super({ ...props, type: 'command-bus', color: 'red' }, children);
    this.amqp = new AMQPCommandBus.AMQPCommandBus({ ...this.props, ...props.AMQP });
  }

  public listen(topic: string, handler: (command: Command<any>) => void): boolean {
    this.logger.log('%red %s', 'Listen', topic);
    this.amqp.listen(topic, handler);
    return true;
  }

  public send(topic: string, id: string, order: string, data: any, meta?: any): Promise<void> {
    if (id == null) id = uuid();
    this.logger.log('%red %s-%s : %s %j', 'Command', topic, id, order, data);
    const type = topic.split('-').shift();
    const command = new Command(type, id, order, data, meta);
    this.amqp.send(topic, command);
    return Promise.resolve();
  }

  public discard(command: Command<any>): Promise<void> {
    return this.amqp.ack(command);
  }

  public replay(command: Command<any>): Promise<void> {
    this.logger.todo();
    return Promise.resolve();
  }

  public relocate(command: Command<any>, topic: string): Promise<void> {
    this.logger.todo();
    return Promise.resolve();
  }

  //--

  public start(): Promise<boolean> {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    return this.amqp.start();
  }

  public stop(): Promise<void> {
    return this.amqp.stop();
  }

}
