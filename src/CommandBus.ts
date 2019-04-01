import * as Component from './Component';
import { command }    from './command';

export interface props extends Component.props {}
export interface children extends Component.children {}

export class CommandBus extends Component.Component {
  constructor(props: props, children: children) {
    super(props, children);
  }

  public listen(topic: string, handler: (command: command<any>) => void): boolean {
    return true;
  }

  public send(type: string, id: string, order: string, data: any, meta?: any): Promise<void> {
    this.logger.log('%red %s-%s : %s', 'Command', type, id, order);
    return Promise.resolve();
  }

  public discard(command: command<any>): Promise<void> {
    return Promise.resolve();
  }

  public replay(command: command<any>): Promise<void> {
    return Promise.resolve();
  }

  public relocate(command: command<any>, topic: string): Promise<void> {
    return Promise.resolve();
  }

}
