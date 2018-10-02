import { EventBus }           from './EventBus';
import { InEvent, EventData } from './Event';

type EntityClass<T> = { new(data?: any): T };
type Typer          = { [event: string]: EntityClass<EventData> } };
type Reducer        = { [event: string]: (state: T, event: InEvent<any>) => T };
type Streams        = { [stream: string]: Stream };

interface Stream {
  subscription: any;
  typer: Typer;
  reducer?: Reducer;
  group?: (event: InEvent) => string;
}

interface Storage<T> {
  get: (key: string) => { number: number, date: number, data: T };
  set: (key: string, T) => void;
  fetch?: (key: string) => Priomise<T>;
  list?:  () => { [key: string]: { number: number, date: number, data: T } };
  clear?: ({ [key: string]: number }) => void;
}

export class StateHandler <E extends Entity> {
  private bus:     EventBus;
  private Entity:  EntityClass<E>;
  private storage: Storage<Type>;
  private streams: Streams;

  constructor(
    bus: EventBus, streams: Streams, Entity: EntityClass<E>, storage?: Storage<E>, handler?: Handler
  ) {
    this.bus     = bus;
    this.streams = streams;
    this.Entity  = Entity;
    this.storage = storage;
    this.handler = handler;
  }

  protected connect() {
    for (const [name, stream] of this.streams) {
      if (stream.subscription != null) continue ;
      const method = ~name.indexOf(':') ? 'consume' : 'subscribe';
      stream.subscription = this.bus[method](name, async event => {
        this.logger.log( '%cyan %green [ %yellow ] %s@%s', '<<', 'Event'
                       , event.type, event.number, event.stream
                       );
        const type = event.type;
        const isSnapshot = type == 'Snapshot';
        if (type in stream.typer) event.data = new stream.typer[type](event.data);
        else if (isSnapshot) event.data.data = new this.Type(event.data.data);
        const key = stream.group(event);
        let stored = null;
        if (event.number == 0) {
          stored = { number: -1, date: null, data: new this.Type() };
        } else if (isSnapshot) {
          stored = event.data;
        } else {
          if (this.storage != null) stored = this.storage.get(key);
          if (stored == null) stored = await this.rehydrate(key);
          if (stored == null) stored = { number: -1, date: null, data: new this.Type() };
        }
        if (type in reducer) stored.data = reducer[type](stored.data, event);
        stored.number = event.number;
        stored.date   = Date.now();
        this.storage.set(key, stored);
        if (!isSnapshot && this.handler != null) this.handler(stored.data, event);
        else if (event.ack) event.ack();
      });
    }
  }

  protected async rehydrate(key) {
    /*const events = [];
    do {
      const slice = await this.bus.last(key, 100);
      -> Search last snapshot
      -> if > 1000 events warn
      -> if not found in 5000 events warn & stop
    } while (...);
    apply events
    return data;
    */
    return null;
  }

}
