import { Service, Kind }         from './Service';
import { Reducer, Categories }   from './Reducer';
import { Buffer }                from './Buffer';
import { Event, EventData }      from './Event';
import { Command, CommandData }  from './Command';

export type Class<T>       = { new(data?: any): T };
export type Typers         = { [name: string]: Class<EventData> };
export type Automates<T>   = { [name: string]: Automate<T> | string };
export type Automate<T>    = { pattern: Pattern, action: Reaction<T> };
export type Pattern        = any;
export type Reaction<T>    = (state: T, Event<EventData>) => Array<Command<CommandData>>;
export type Projections<T> = { [name: string]: Projection<T> };
export type Projection<T>  = (state: T, Event<EventData>) => ProjectionResponse;
type ProjectionResponse    = Array<Event<EventData>>
                           | { events: Array<Event<EventData>>, call: () => void }
                           | async () => Array<Event<EventData>>;

export interface Options {
  bufferSize?: number;
}

export class EventHandler<T extends Entity> extends Service {

  protected pipe:        string;
  protected typers:      Typers;
  protected options:     Options;
  protected buffer:      Buffer<T>;
  protected reducer:     Reducer<T>;
  protected automates:   Automates<T>;
  protected projections: Projections<T>;

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

  public trigger(automates: Automates<T>) {
    this.automates = automates;
    return this;
  }

  public project(projections: Projections<T>) {
    this.projections = projections;
    return this;
  }

  // --

  public async start(config: any) {
    await super.start(config);
    const subscription = this.bus.E.consume(this.pipe, event => this.handleEvent(event));
    this.subscriptions[this.pipe] = subscription;
    return true;
  }

  // --

  protected async handleEvent(event: InEvent<any>) {
    // Type Event
    // Retrieve state from buffer
    // > If next event then apply event
    // > Else if missing event, park event
    // > Else if missing state fetch stream
    // If automates exists then execute
    // If projections exists then execute
    // Dispatch commands & events
  }

}
