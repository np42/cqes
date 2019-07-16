import * as Component from './Component';
import * as Factory   from './Factory';

export interface props extends Component.props {
  events?:  { [name: string]: { new (data: any): any } }
  state?:   { new (data: any): any }
  factory?: Factory.Factory;
}

export class Service extends Component.Component {
  protected factory: Factory.Factory;
  protected events:  { [name: string]: { new (data: any): any } };
  protected state:   { new (data: any): any }

  constructor(props: props) {
    super(props);
    this.events  = props.events  || {};
    this.state   = props.state   || Object;
    this.factory = props.factory || new Factory.Factory(props);
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;
    if (this.factory) await this.factory.start();
    return super.start();
  }

  public async stop(): Promise<void> {
    if (!this.running) return ;
    if (this.factory) await this.factory.stop();
    return super.stop();
  }

}