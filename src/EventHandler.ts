import { Service, Kind }         from './Service';
import { Reducer, Categories }   from './Reducer';
import { Buffer }                from './Buffer';
import { Event, EventData }      from './Event';

export type Class<T>  = { new(data?: any): T };
export type Typers    = { [name: string]: Class<EventData> };

export interface Options {
  bufferSize?: number;
}

export class EventHandler<T extends Entity> extends Service {

  protected pipe:        string;
  protected typers:      Typers;
  protected buffer:      Buffer<T>;

  constructor(pipe: string, typers: Typers, options?: Options) {
    super(pipe, Kind.Event);
    this.pipe    = pipe;
    this.typers  = typers || {};
    this.options = options || { bufferSize: 500 };
  }

  public reduce(Entity: Class<T>, categories: Categories<T>) {
    const onFetch = async (key: string, state: T) => {
      if (state != null) return state;
      const events = await this.bus.E.last(key);
      const result = this.reducer.apply(state, events);
      return result;
    };
    const size = this.options.bufferSize;
    this.reducer = new Reducer(Entity, categories);
    this.buffer  = new Buffer(Entity, { onFetch, size });
    return this;
  }

  
}