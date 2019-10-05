import * as Component from './Component';
import { CommandBus } from './CommandBus';
import { QueryBus }   from './QueryBus';
import { v4 as uuid } from 'uuid';

export interface props extends Component.props {
  streamName: string;
  cBus:       CommandBus;
  qBus:       QueryBus;
}

export class Index extends Component.Component {
  protected streamName: string;
  protected cBus:       CommandBus;
  protected qBus:       QueryBus;

  constructor(props: props) {
    super(props);
    this.streamName = props.streamName;
    this.cBus       = props.cBus;
    this.qBus       = props.qBus;
  }

  public async command(order: string, id: string, data: any, meta?: any) {
    if (id == null) id = uuid();
    await this.cBus.send(this.streamName, id, order, data, meta);
    return { id };
  }

  public async query(view: string, data: any, meta?: any) {
    return this.qBus.request(this.streamName, view, data, meta);
  }

}
