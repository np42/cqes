import { Bus }    from './Bus';
import { Logger } from './Logger';

export interface Props {
  name:             string;
  type:             string;
  color?:           string;
  bus?:             Bus;
  [others: string]: any;
}

export interface Children {}

export class Component {
  protected props:    Props;
  protected children: Children;
  protected logger:   Logger;
  protected bus:      Bus;

  constructor(props: Props, children: Children) {
    this.props    = props;
    this.children = children;
    this.logger   = new Logger(props.name + '.' + props.type, props.color);
    this.bus      = props.bus;
  }

  sprout(name: string, alternative?: any) {
    const childProps = this.props[name] || {};
    const props = { ...this.props, type: name, ...childProps, bus: this.bus };
    if (this.children[name] instanceof Function) {
      const module = this.children[name];
      if (typeof module != 'function')
        throw new Error(this.props.name + '.' + name + ': must be a constructor');
      const instance = new module(props, this.children);
      this.children[name] = instance;
      return instance;
    } else if (this.children[name] instanceof Component) {
      return this.children[name];
    } else if (alternative != null) {
      const instance = new alternative[name](props, this.children);
      this.children[name] = instance;
      return instance;
    }
    throw new Error('Unable to sprout ' + name);
  }

}
