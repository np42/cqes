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
    this.factory = props.factory || new Factory.Factory({});
  }

  public start(): Promise<boolean> {
    if (this.factory) return this.factory.start();
    return super.start();
  }

  public stop(): Promise<void> {
    return super.stop();
  }

}