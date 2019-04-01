import * as Component from './Component';
import * as Bus       from './Bus';

import { command }    from './command';
import { query }      from './query';
import { reply }      from './reply';

export interface props extends Component.props {
  bus: Bus.Bus;
}
export interface children extends Component.children {}

export class Service extends Component.Component {
  private   enabled: boolean;
  protected bus:     Bus.Bus;

  constructor(props: props, children: children) {
    super(props, children);
    this.enabled = false;
    this.bus = props.bus;
  }

  public start(): Promise<boolean> {
    this.enabled = true;
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    this.enabled = false;
    return Promise.resolve();
  }

  public handle(command: command<any>): void {
    this.logger.warn('Command discarded %s %j', command.order, command.data);
    this.bus.command.discard(command);
  }

  public resolve(query: query<any>): Promise<reply<any>> {
    this.logger.warn('Query unresolved %s %j', query.view, query.data);
    return Promise.resolve(null);
  }

}
