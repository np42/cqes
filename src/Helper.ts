import * as Component from './Component';

export type ActionHandler = (...args: Array<any>) => Promise<any>;

export interface props extends Component.props {

}

export class Helper extends Component.Component {

  constructor(props: props) {
    super(props);
  }

}
