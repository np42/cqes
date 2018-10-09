import { Service, Kind }         from './Service';
import { Reducer, Categories }   from './Reducer';
import { Buffer }                from './Buffer';
import { Command, CommandData }  from './Command';
import { Event, EventData }      from './Event';
import { Entity }                from './Aggregate';

export type Class<T>       = { new(data?: any): T };
export type Typers         = { [name: string]: Class<CommandData> };
export type Translators<T> = { [name: string]: Translator<T> };
export type Translator<T>  = (state: T, command: Command<CommandData>) => Array<Command<CommandData>>;
export type Managers<T>    = { [name: string]: Manager<T> };
export type Manager<T>     = (state: T, command: Command<CommandData>) => Array<Event<EventData>>;

export interface Options {
  bufferSize?: number;
}

export class CommandHandler<T extends Entity> extends Service {

  protected topic:       string;
  protected typers:      Typers;
  protected buffer:      Buffer<T>;
  protected reducer:     Reducer<T>;
  protected translators: Translators<T>;
  protected managers:    Managers<T>;

  constructor(topic: string, typers: Typers, options?: Options) {
    super(topic, Kind.Command);
    this.topic       = topic;
    this.typers      = typers || {};
    this.options     = options || { bufferSize: 500 };
    this.translators = {};
    this.managers    = {};
  }

  public reduce(Entity: Class<T>, categories: Categories<T>) {
    const onFetch = async (key: string, state: T) => {
      const events = await (state == null ? this.bus.E.last(key) : this.bus.E.read(key, state.number));
      const result = this.reducer.apply(state, events);
      return result;
    };
    const size = this.options.bufferSize;
    this.reducer = new Reducer(Entity, categories);
    this.buffer  = new Buffer(Entity, { onFetch, size });
    return this;
  }

  public translate(translators: Translators<T>) {
    this.translators = translators;
    return this;
  }

  public manage(managers: Managers<T>) {
    this.managers = managers;
    return this;
  }

  // --

  public async start(config: any) {
    await super.start(config);
    const subscription = this.bus.C.listen(this.topic, command => this.handleCommand(command));
    this.subscriptions[this.topic] = subscription;
    return true;
  }

  // --

  protected async handleCommand(command: InCommand<any>) {
    // Type command
    // Retrieve from buffer state
    // if translator exists then execute
    // if manager exists then execute
    // dispatch events
    // > OK: acknowledge command
    //       dispatch commands
    // > KO: try this workflow again
  }

}
