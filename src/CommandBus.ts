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

  constructor(props: props) {
    super({ logger: 'CommandBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.channel == null) throw new Error('Missing channel reference');
    this.transport = new Transport(props);
    this.channel   = props.channel;
    this.commands  = props.commands || {};
  }

  public start(): Promise<void> {
    return this.transport.start();
  }

  public listen(handler: commandHandler): Promise<Subscription> {
    return this.transport.listen(this.channel, (command: Command) => {
      if (command.order in this.commands)
        command.data = new this.commands[command.order](command.data);
      return handler(command);
    });
  }

  public send(category: string, id: string, order: string, data: any, meta?: any) {
    const command = new Command(category, id, order, data, meta);
    return this.sendCommand(command);
  }

  public sendCommand(command: Command): Promise<void> {
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    return this.transport.stop();
  }

}
