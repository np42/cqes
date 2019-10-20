import * as Component from './Component';
import { Command }    from './Command';
import { Typer }      from './Type';

export type commandHandler = (commmand: Command) => Promise<void>;

export interface Subscription {
  abort: () => Promise<void>;
}

export interface Transport {
  start:  () => Promise<void>;
  listen: (channel: string, handler: commandHandler) => Promise<Subscription>;
  send:   (command: Command) => Promise<void>;
  stop:   () => Promise<void>;
}

export interface props extends Component.props {
  transport:  string;
  channel:    string;
  commands:   { [name: string]: Typer };
}

export class CommandBus extends Component.Component {
  protected commands:  { [name: string]: Typer };
  protected transport: Transport;
  protected channel:   string;
  protected category:  string;

  constructor(props: props) {
    super({ logger: 'CommandBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.channel == null) throw new Error('Missing channel reference');
    this.transport = new Transport(props);
    this.channel   = props.channel;
    this.commands  = props.commands || {};
    const offset   = this.channel.indexOf('.');
    this.category  = offset === -1 ? this.channel : this.channel.substring(0, offset);
  }

  public start(): Promise<void> {
    return this.transport.start();
  }

  public listen(handler: commandHandler): Promise<Subscription> {
    return this.transport.listen(this.channel, (command: Command) => {
      if (command.order in this.commands) {
        try {
          command.data = this.commands[command.order].from(command.data);
        } catch (e) {
          this.logger.error('Command discarded %j\n%e', command, e);
          return Promise.resolve();
        }
      }
      return handler(command);
    });
  }

  public send(id: string, order: string, data: any, meta?: any) {
    const command = new Command(this.category, id, order, data, meta);
    return this.sendCommand(command);
  }

  public sendCommand(command: Command): Promise<void> {
    if (command.order in this.commands)
      command.data = this.commands[command.order].from(command.data);
    return this.transport.send(command);
  }

  public stop(): Promise<void> {
    return this.transport.stop();
  }

}
