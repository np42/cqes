import { Bus }    from './Bus';
import { Logger } from './Logger';

const USED = Symbol('CHILD_ALREADY_USED');

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
    if (this.children[name] === USED)
      throw new Error('Child ' + name + ' already used');
    if (this.children[name] != null) {
      const module = this.children[name];
      if (typeof module != 'function')
        throw new Error(this.props.name + '.' + name + ': must be a constructor');
      this.children[name] = USED;
      return new module(props, this.children);
    } else if (alternative != null) {
      this.children[name] = USED;
      return new alternative[name](props, this.children);
    }
    throw new Error('Unable to sprout ' + name);
  }

}
