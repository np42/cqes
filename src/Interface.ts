import { Bus }        from './Bus';
import * as Component from './Component';

export interface Props extends Component.Props {}

export class Interface {
  protected props: Props;
  protected bus:   Bus;

  constructor(props: Props) {
    this.props = props;
    this.bus   = props.bus;
  }

}
