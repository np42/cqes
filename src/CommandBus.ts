import * as Component         from './Component';
import { command as Command } from './command';
import * as AMQPCommandBus    from './AMQPCommandBus';

export interface props extends Component.props {
  AMQP?: AMQPCommandBus.props
}
export interface children extends Component.children {}

export class CommandBus extends Component.Component {
  protected shared: void; // TODO
  protected pipe:   void; // TODO
  protected amqp:   AMQPCommandBus.AMQPCommandBus;

  constructor(props: props, children: children) {
    super({ ...props, type: props.type + '.command', color: 'red' }, children);
    this.amqp = new AMQPCommandBus.AMQPCommandBus({ ...props, ...props.AMQP });
  }

  public listen(topic: string, handler: (command: Command<any>) => void): boolean {
    this.logger.log('Listen', topic);
    this.amqp.listen(topic, handler);
    return true;
  }

  public send(topic: string, id: string, order: string, data: any, meta?: any): Promise<void> {
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
    return Promise.resolve();
  }

  public relocate(command: Command<any>, topic: string): Promise<void> {
    return Promise.resolve();
  }

  //--

  public start(): Promise<boolean> {
    return this.amqp.start();
  }

  public stop(): Promise<void> {
    return this.amqp.stop();
  }

}
