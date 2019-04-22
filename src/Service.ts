import * as Component from './Component';
import * as Factory   from './Factory';
import * as Bus       from './Bus';

export interface props extends Component.props {
  bus: Bus.Bus;
}

export interface children extends Component.children {
  Factory?: { new (p: Factory.props, c: Factory.children): Factory.Factory };
}

export class Service extends Component.Component {
  protected bus:     Bus.Bus;
  protected factory: Factory.Factory;

  constructor(props: props, children: children) {
    super(props, children);
    this.bus     = props.bus;
    this.factory = this.sprout('Factory', Factory);
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}