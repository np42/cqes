import { Bus }        from './Bus';
import { Logger }     from './Logger';
import * as Component from './Component';

export interface Props extends Component.Props {}

export class Interface {
  protected props:  Props;
  protected bus:    Bus;
  protected logger: Logger;

  constructor(props: Props) {
    this.props  = props;
    this.bus    = props.bus;
    this.logger = new Logger(props.name + ' :: ' + this.constructor.name, 'magenta');
  }

}
