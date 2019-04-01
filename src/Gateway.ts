import * as Service     from './Service';

export interface props extends Service.props {}

export interface children extends Service.children {}

export class Gateway extends Service.Service {

  constructor(props: props, children: children) {
    super({ type: 'gateway', color: 'yellow', ...props }, children);
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}
