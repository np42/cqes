import { Logger }             from './Logger';

export enum Kind { Command = 'red', Query = 'blue', Event = 'green', State = 'grey' };

export type Subscriptions { [name: string]: any };

export class Service  {

  protected logger:        Logger;
  protected bus:           CQESBus;
  protected subscriptions: Subscriptions;

  constructor(kind: Kind, name: string) {
    this.logger = new Logger(name, kind);
  }

  // --

  public async start(config: any) {
    this.bus = new CQES(config);
    return true;
  }

  public async stop() {
    return false;
  }

}
