import { Logger } from './Logger';

export interface props {
  name:             string;
  type:             string;
  color?:           string;
  [others: string]: any;
}

export interface children {}

export class Component {
  protected name:     string;
  protected props:    props;
  protected children: children;
  protected logger:   Logger;

  constructor(props: props, children: children) {
    this.name     = props.name;
    this.props    = props;
    this.children = children;
    this.logger   = new Logger(props.name + '.' + props.type, props.color);
  }

  sprout(name: string, alternative: any, extra?: any) {
    const childProps = this.props[name] || {};
    const props = { ...childProps, ...extra };
    for (const key in this.props) {
      if (key[0] === key[0].toUpperCase() && key !== name && props[key] == null)
        props[key] = this.props[key];
      if (key[0] === key[0].toLowerCase() && props[key] == null)
        props[key] = this.props[key];
    }
    if (props.name == null) props.name = this.props.name;
    if (this.children[name] instanceof Function) {
      const component = this.children[name];
      if (typeof component != 'function')
        throw new Error(this.props.name + '.' + name + ': must be a constructor');
      const instance = new component(props, this.children);
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
