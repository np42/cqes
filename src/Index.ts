import * as Component from './Component';

export interface props extends Component.props {
  name:     string;
  commands: { [name: string]: { new (a: any): any } };
  queries:  { [name: string]: { new (a: any): any } };
  replies:  { [name: string]: { new (a: any): any } };
}

export class Index extends Component.Component {
  protected name:     string;
  protected commands: { [name: string]: { new (a: any): any } };
  protected queries:  { [name: string]: { new (a: any): any } };
  protected replies:  { [name: string]: { new (a: any): any } };

  constructor(props: props) {
    super(props);
    this.name     = props.name ;
    this.commands = props.commands || {};
    this.queries  = props.queries  || {};
    this.replies  = props.replies  || {};
  }

  public async sendCommand(name: string, id: string, data: any, meta?: any) {
    if (this.commands[name] == null) throw new Error('Command ' + name + ' not found');
    const command = new this.commands[name](data);
    return this.bus.command.send(this.name, id, name, command, meta);
  }

  public async requestQuery(name: string, data: any, meta?: any) {
    console.log(name, data, meta);
    debugger;
  }

}
