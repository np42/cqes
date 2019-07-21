import * as Component from './Component';

import { event as E }  from './event';

export interface props extends Component.props {
  events?: { [name: string]: { new (data: any): any } }
}

export class Gateway extends Component.Component {
  protected events: { [name: string]: { new (data: any): any } };
  protected stream: string;

  constructor(props: props) {
    super(props);
    this.events = props.events || {};
    this.stream = this.context + '.' + this.module;
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;
    return new Promise((resolve, reject) => super.start().then(() => {
      if (!this.bus.event) {
        this.logger.error('Event Bus not enabled');
        return resolve(false);
      }
      this.bus.event.psubscribe(this.service, this.stream, async event => {
        const type = this.events[event.name];
        if (type == null) {
          this.logger.error('No type for %j', event);
          throw new Error('Event type is missing');
        } else {
          event.data = new type(event.data);
          return this.on(event)
        }
      }).then(() => resolve(true))
        .catch(e => {
          this.logger.error(e);
          resolve(false);
        });
    }));
  }

  public async stop(): Promise<void> {
    if (!this.running) return ;
    return super.stop();
  }

  public async on(event: E) {
    if (!(event.name in this)) return ;
    return await this[event.name](event);
  }

}
