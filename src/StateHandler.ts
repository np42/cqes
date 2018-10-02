import { Logger }             from './Logger';
import { EventBus }           from './EventBus';
import { InEvent, EventData } from './Event';
import { Entity }             from './Aggregate';

type EntityClass<T> = { new(data?: any): T };
type Typer          = { [event: string]: EntityClass<EventData> };
type Reducer<T>     = { [event: string]: (state: T, event: InEvent<any>) => T };
type Streams        = { [stream: string]: any };
type Categories<T>  = { [category: string]: Category<T> };
type Handler<T>     = (state: T, event: InEvent<any>) => boolean;

interface Category<T> {
  typer: Typer;
  reducer?: Reducer<T>;
  group?: (event: InEvent<any>) => string;
}

interface Storage<T> {
  get: (key: string) => { number: number, date: number, data: T };
  set: (key: string, data: T) => void;
  fetch?: (key: string) => Promise<T>;
  list?:  () => { [key: string]: { number: number, date: number, data: T } };
  clear?: (list: { [key: string]: number }) => void;
}

export class StateHandler <E extends Entity> {
  private logger:     Logger;
  private bus:        EventBus;
  private streams:    Streams;
  private categories: Categories<E>;
  private Entity:     EntityClass<E>;
  private storage:    Storage<E>;
  private handler:    Handler<E>;

  constructor(
    bus: EventBus, streams: Array<string>, categories: Categories<E>, Entity: EntityClass<E>,
    storage?: Storage<E>, handler?: Handler<E>
  ) {
    this.logger  = new Logger(Entity.name, 'gray');
    this.bus     = bus;
    this.streams = streams.reduce((map, stream) => { map[stream] = null; return map; }, {});
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
        const type = event.type;
        const category = this.categories[event.category];
        const isSnapshot = type == 'Snapshot';
        if (type in category.typer) event.data = new category.typer[type](event.data);
        else if (isSnapshot) event.data.data = new this.Entity(event.data.data);
        const key = category.group(event);
        let stored = null;
        if (event.number == 0) {
          stored = { number: -1, date: null, data: new this.Entity() };
        } else if (isSnapshot) {
          stored = event.data;
        } else {
          if (this.storage != null) stored = this.storage.get(key);
          if (stored == null) stored = await this.rehydrate(key);
          if (stored == null) stored = { number: -1, date: null, data: new this.Entity() };
        }
        if (type in category.reducer) stored.data = category.reducer[type](stored.data, event);
        stored.number = event.number;
        stored.date   = Date.now();
        this.storage.set(key, stored);
        if (!isSnapshot && this.handler != null)
          if (this.handler(stored.data, event))
            return ;
        event.ack();
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
