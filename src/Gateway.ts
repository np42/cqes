import * as Service from './Service';

import { event as E }  from './event';
import { state as S }  from './state';

export interface props extends Service.props {}

export class Gateway extends Service.Service {

  public async start(): Promise<boolean> {
    if (this.running) return true;
    return new Promise((resolve, reject) => super.start().then(() => {
      if (!this.bus.event) {
        this.logger.error('Event Bus not enabled');
        return resolve(false);
      }
      this.bus.event.psubscribe(this.service, this.module, async (id, revision, events, date) => {
        const state = this.factory ? await this.factory.get(id) : new S(this.context, id, -1, null);
        for (const event of events) {
          const type = this.events[event.name];
          if (type == null) {
            this.logger.error('No type for %j', event);
            throw new Error('Event type is missing');
          } else {
            event.data = new type(event.data);
            event.meta = { createdAt: new Date(date), ...event.meta };
            return this.on(state, event)
          }
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

  public async on(state: S, event: E) {
    if (!(event.name in this)) throw new Error('Missing handler: ' + event.name);
    return await this[event.name](state, event);
  }

}
