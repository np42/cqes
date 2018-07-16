import { InEvent }          from './Event';
import { State, StateData } from './State';
const Cache                 = require('caching-map');

export interface Options {
  size?: number; // The number of entity to keep in memeory
  ttl?:  number; // Time to keep element in memory
}

export interface RecordOptions {
  ttl?: number;
  cost?: number;
}

export class MemoryState<D extends StateData> extends State<CacheMap<D>> {

  constructor(options?: Options) {
    if (options == null)      options = {};
    if (options.size == null) options.size = 100;
    if (options.ttl == null)  options.ttl = null;
    super(CacheMap, options);
  }

}

class CacheMap<D extends StateData> extends StateData {
  private entries: Map<string, D>;
  private ttl: number;

  constructor(options: Options) {
    super();
    this.entries = new Cache(options.size);
    this.ttl = options.ttl;
  }

  public get(key: string) {
    return this.entries.get(key);
  }

  public set(key: string, value: D, options?: RecordOptions) {
    if (options == null) options = { ttl: this.ttl };
    (<any>this.entries).set(key, value, options);
  }

  public delete(key: string) {
    this.entries.delete(key);
  }

  public apply(events: InEvent<any> | Array<InEvent<any>>): void {
    if (!(events instanceof Array)) events = [events];
    for (const event of events) {
      const id = event.entityId;
      const data = this.get(id);
      if (data == null) continue ;
      data.apply(event);
      this.set(id, data);
    }
  }

}
