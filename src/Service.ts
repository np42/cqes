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
    if ('Factory' in children)
      this.factory = this.sprout('Factory', Factory, { bus: this.bus });
  }

  public start(): Promise<boolean> {
    if (this.factory) return this.factory.start();
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}