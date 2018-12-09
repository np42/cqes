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

  sprout(name: string, alternative: any) {
    const props = this.props[name] || {};
    if (alternative == null) alternative = { [name]: function () {} };
    if (this.children[name] == null) return new alternative[name](props);
    
  }

}
