import * as Component         from './Component';
import { Command as C }       from './Command';
import { Typer }              from './Type';

export type commandHandler = (commmand: C) => Promise<void>;

export interface Subscription {
  abort: () => Promise<void>;
}

export interface Transport {
  start:  () => Promise<void>;
  listen: (channel: string, handler: commandHandler) => Promise<Subscription>;
  send:   (command: C) => Promise<void>;
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

  public listen(handler: commandHandler): Promise<Subscription> {
    return Promise.resolve(null);
  }

  public send(category: string, id: string, order: string, data: any, meta?: any) {
    const command = new C(category, id, order, data, meta);
    return this.sendCommand(command);
  }

  public sendCommand(command: C): Promise<void> {
    return Promise.resolve();
  }

}
