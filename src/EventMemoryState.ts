import { EventBus }             from './EventBus';
import { StateData }            from './State';
import { MemoryState, Options } from './MemoryState';

export interface EventOptions extends Options {
  window?: number;
  process?: string;
}

export class EventMemoryState<D extends StateData> extends MemoryState<D> {
  protected StateDataClass: new(key: string) => D;
  protected bus:            EventBus;
  protected window:         number;
  public    process:        string;

  constructor(StateDataClass: new(key: string) => D, bus: EventBus, options?: EventOptions) {
    if (options == null)        options = {};
    if (options.window == null) options.window = 50;
    super(options);
    this.StateDataClass = StateDataClass;
    this.bus            = bus;
    this.process        = options.process || StateDataClass.name;
    this.window         = options.window;
  }

  async materialize(key: string): Promise<D> {
    const data   = new this.StateDataClass(key);
    const result = await this.bus.last(this.process + '-' + key, this.window);
    if (result.length == 0) return null;
    data.apply(result);
    return data;
  }

  async get(key: string): Promise<D> {
    // FIXME: avoid multi asyncs
    const value = this.data.get(key);
    if (value != null) return value;
    const data = await this.materialize(key);
    if (data == null) return null;
    this.data.set(key, data);
    return data;
  }

}
