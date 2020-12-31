import * as Component from './Component';
import { Command }    from './Command';
import { Typer }      from 'cqes-type';

export type commandHandler = (commmand: Command) => Promise<void>;

export class ConcurencyError extends Error {
  public retry: boolean;
  constructor(e: Error) {
    const message = String(e);
    super(message.substring(message.indexOf(' ') + 1));
    this.stack = e.stack;
    this.retry = true;
  }
}

export interface Subscription { abort: () => Promise<void>; }
export interface CommandTypes { [name: string]: Typer };

export interface Transport {
  start:  () => Promise<void>;
  listen: (channel: string, handler: commandHandler) => Promise<Subscription>;
  send:   (command: Command) => Promise<void>;
  stop:   () => Promise<void>;
}

export interface props extends Component.props {
  transport:  string;
  channel:    string;
  commands:   CommandTypes;
}

export class CommandBus extends Component.Component {
  protected commands:  CommandTypes;
  protected transport: Transport;
  protected channel:   string;
  protected category:  string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.channel == null) throw new Error('Missing channel reference');
    this.transport = new Transport({ ...props, type: 'CommandBus.Transport' });
    this.channel   = props.channel;
    this.commands  = props.commands || {};
    const offset   = this.channel.indexOf('.');
    this.category  = offset === -1 ? this.channel : this.channel.substring(0, offset);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('Connecting to %s', this.channel);
    await super.start();
    await this.transport.start();
  }

  public listen(handler: commandHandler): Promise<Subscription> {
    return this.transport.listen(this.channel, (command: Command) => {
      if (command.order in this.commands) {
        try {
          command.data = this.commands[command.order].from(command.data);
        } catch (e) {
          debugger;
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
    this.logger.log('Sending %red %s %s', 'Command', command.stream, command.order);
    return this.transport.send(command);
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

}
