import * as Service from './Service';
import { deserialize } from "serializer.ts/Serializer";

import { event as E }  from './event';
import { state as S }  from './state';

export interface props extends Service.props {
  events?: { [name: string]: { new (data: any): any } }
}
export interface children extends Service.children {}

export class Gateway extends Service.Service {
  protected events: { [name: string]: { new (data: any): any } };

  constructor(props: props, children: children) {
    super({ type: 'gateway', color: 'yellow', ...props }, children);
    this.events = props.events || {};
  }

  public async start() {
    if (this.factory == null) {
      this.bus.event.psubscribe(this.name, this.context, async (id, revision, events) => {
        const state = new S(id, -1, null);
        for (const event of events) {
          const type = this.events[event.name];
          if (type == null) {
            this.logger.error('No type for %j', event);
            throw new Error('Event type is missing');
          } else {
            event.data = deserialize(type, event.data);
            return this.on(state, event)
          }
        }
      });
    }
    return super.start();
  }

  public async on(state: S, event: E) {
    const method = 'on' + event.name;
    if (!(method in this)) return ;
    return await this[method](state, event);
  }

}
