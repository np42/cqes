import { Logger }             from './Logger';
import { EventBus }           from './EventBus';
import { InEvent, EventData } from './Event';
import { Entity }             from './Aggregate';
import { Buffer }             from './Buffer';

export type Class<T>       = { new(data?: any): T };
export type Typers         = { [event: string]: Class<EventData> };
export type Reducer<T>     = { [event: string]: (state: T, event: InEvent<any>) => T };
export type Categories<T>  = { [category: string]: Category<T> };
export type Handler<T>     = (state: T, event: InEvent<any>) => boolean;

export interface Category<T> {
  typers:  Typers;
  reducer: Reducer<T>;
  group?:  (event: InEvent<any>) => string;
}

export class Reducer <E extends Entity> {
  private logger:     Logger;
  private stream:     any;
  private categories: Categories<E>;
  private Entity:     Class<E>;
  private buffer:     Buffer<E>;
  private handler:    Handler<E>;

  constructor(
    Entity: Class<E>, categories: Categories<E>,
    options?: { stream?: string, buffer?: Buffer<E>, handler?: Handler<E> }
  ) {
    if (options == null) options = {};
    this.logger  = new Logger(Entity.name, 'gray');
    this.Entity  = Entity;
    this.storage = storage;
    this.handler = handler;
  }

  protected connect() {
    for (const stream in this.streams) {
      if (this.streams[stream] != null) continue ;
      const method = ~stream.indexOf(':') ? this.bus.consume.bind(this.bus)
        : this.bus.subscribe.bind(this.bus);
      this.streams[stream] = method(stream, async (event: InEvent<any>) => {
        this.logger.log( '%cyan %green [ %yellow ] %s@%s', '<<', 'Event'
                       , event.type, event.number, event.stream
                       );
        /* Typing */
        const type = event.type;
        const category = this.categories[event.category];
        const isSnapshot = type == 'Snapshot';
        if (type in category.typer) event.data = new category.typer[type](event.data);
        else if (isSnapshot) event.data.data = new this.Entity(event.data.data);
        /* -- */

        /* Getting previous version */
        const key = category.group(event);
        let stored = null;
        if (event.number == 0) {
          stored = { number: -1, date: null, data: new this.Entity() };
        } else if (isSnapshot) {
          stored = event.data;
        } else {
          if (this.storage != null) stored = this.storage.get(key, event.number - 1);
          if (stored == null) stored = await this.rehydrate(key, event.number);
          if (stored == null) stored = { number: -1, date: null, data: new this.Entity() };
        }
        /* -- */

        /* Apply event */
        if (type in category.reducer) stored.data = category.reducer[type](stored.data, event);
        stored.number = event.number;
        stored.date   = Date.now();
        /* -- */

        /* Store state */
        this.storage.set(key, stored);
        /* -- */

        /* Delegate to notifier */
        if (!isSnapshot && this.handler != null)
          if (this.handler(stored.data, event))
            return ;
        event.ack();
        /* -- */
      });
    }
  }

  protected async rehydrate(stream: string) {
    const events = await this.bus.last(stream, (event: InEvent<any>, count: number) => {
      if (count > 5000) return false;
      if (event.type == 'Snapshot') return false;
      return true;
    });
    if (events.length == 0) return null;
    else if (events.length > 5000) this.logger.warn('Snapshot not found');
    else if (events.length > 1000) this.logger.warn('Too many events before snapshot');
    const first = events[0];
    let data = first.type == 'Snapshot' ? new this.Entity(events.unshift()) : new this.Entity();
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      const category = this.categories[event.category];
      if (event.type in category.reducer) data = category.reducer[event.type](data, event);
    }
    return data;
  }

}
