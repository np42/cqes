import * as Component from './Component';
import { v4 as uuid } from 'uuid';

export interface props extends Component.props {
  stream:   string;
  commands: { [name: string]: { new (a: any): any } };
  queries:  { [name: string]: { new (a: any): any } };
  replies:  { [name: string]: { new (a: any): any } };
}

export class Index extends Component.Component {
  protected stream:   string;
  protected commands: { [name: string]: { new (a: any): any } };
  protected queries:  { [name: string]: { new (a: any): any } };
  protected replies:  { [name: string]: { new (a: any): any } };

  constructor(props: props) {
    super(props);
    this.stream   = props.stream   || props.context + '.' + props.module;
    this.commands = props.commands || {};
    this.queries  = props.queries  || {};
    this.replies  = props.replies  || {};
  }

  public async sendCommand(name: string, id: string, data: any, meta?: any) {
    if (this.commands[name] == null) throw new Error('Command ' + name + ' not found');
    const command = new this.commands[name](data);
    if (id == null) id = uuid();
    return this.bus.command.send(this.stream, id, name, command, meta);
  }

  public async requestQuery(name: string, data: any, meta?: any) {
    if (this.queries[name] == null) throw new Error('Query ' + name + ' not found');
    const query = new this.queries[name](data);
    return this.bus.query.request(this.stream, name, query, meta);
  }

}
