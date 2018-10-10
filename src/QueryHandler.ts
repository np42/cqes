import { Service, Kind }         from './Service';
import { QueryData, ReplyData }  from './Query';

export type Class<T> = { new (data?: any): T };
export type Typers   = { [name: string]: Class<EventData> };

export type Item<T> = { key: string, number: number, data: T };

export interface Store<T, L> {
  start:   (config: any) => Promise<boolean>;
  stop:    () => Promise<boolean>;
  link:    L;
  fetch:   (key: string) => Promise<Item<T>>;
  upsert:  (items: Array<Item<T>>) => Promise<void>;
}

export type Selectors<L> = { [view: string]: Selector<L> };
export type Selector<L>  = { query: Class<QueryData>, requester: Requester<L>, reply: Class<ReplyData> };
export type Requester<L> = (link: L, request: QueryData) => any;

export interface Options {
  bufferSize?: number;
}

export class QueryHandler<T extends Entity> extends Service {

  protected pipe:      string;
  protected typers:    Typers;
  protected options:   Options;
  protected store:     Store<T>;
  protected selectors: Selectors<any>;
  protected timer:     NodeJS.Timer;

  constructor(pipe: string, typers: Typers, options?: Options) {
    super(pipe, Kind.Query);
    this.typers   = typers || {};
    this.options  = options || {};
    if (this.options.bufferSize == null) this.options.bufferSize = Infinity;
    if (this.options.bufferExpire == null) bufferExpire = 1000;
    const onFetch = (key: string) => {
      if (this.store == null) return null;
      return this.store.fetch(key);
    };
    const size    = this.options.bufferSize;
    this.buffer   = new Buffer(Entity, { onFetch, size });
  }

  public serve<L>(store: Store<T, L>, selectors?: Selector<L>) {
    this.store     = store;
    this.selectors = selectors || {};
    return this;
  }

  // --

  public async start(config: any) {
    await super.start(config);
    if (this.store) {
      await this.store.start();
      this.saveBufferToStorageLoop(true);
    }
    this.bus.Q.serve(view, query => this.handleQuery(query));
  }

  public async stop() {
    let flag = true;
    if (this.store) flag = await this.store.stop();
    return await super.stop() && flag;
  }


  // --

  protected handleQuery(query: InQuery<any>) {
    // Type query
  }

  protected async saveBufferToStorageLoop(force = false: boolean) {
    if (!force && this.timer == null) return ;
    const next = Date.now() + this.options.bufferExpire;
    await this.saveBufferToStorage();
    if (!force && this.timer == null) return ;
    const now = Date.now();
    if (now < next + 20) setImmediate(() => this.saveBufferToStorageLoop());
    else this.timer = setTimeout(() => this.saveBufferToStorageLoop(), next - now);
  }

  protected async saveBufferToStorage() {
    const items = this.getBufferItems();
    await this.store.upsert(items);
    this.buffer.release(items);
  }

  protected getBufferItems() {
    const maxAge = Date.now() - (this.options.bufferExpire * 0.75);
    const result = this.buffer.list(item => item.date <= maxAge);
    return result;
  }

}
