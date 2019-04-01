import * as Bus       from './Bus';
import { Logger }     from './Logger';
import * as Component from './Component';

export interface props extends Component.props {
  bus: Bus.Bus;
}

export class Interface {
  protected props:  props;
  protected bus:    Bus.Bus;
  protected logger: Logger;

  constructor(props: props) {
    this.props  = props;
    this.bus    = props.bus;
    this.logger = new Logger(props.name + ' :: ' + this.constructor.name, 'magenta');
  }

}
