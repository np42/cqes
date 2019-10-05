import * as Component   from './Component';
import * as Factory     from './Factory';
import { state as S }   from './state';
import { event as E }   from './event';

const CachingMap = require('caching-map');

export interface props extends Component.props {
  state:    { new (a: any): any };
  size?:    number;
  ttl?:     number;
  factory?: Factory.Factory;
}

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
  has(key: K): boolean;
  delete(key: K): void;
  clear(): void;
}

type PromiseHandler = { resolve: (a: any) => void, reject: (e: Error) => void };

export class Buffer extends Component.Component {
  protected state:        { new (a: any): any };
  protected stream:       string;
  protected cache:        CachingMap<string, S<any>>;
  protected ttl:          number;
  protected factory:      Factory.Factory;
  protected pending:      Map<string, Array<PromiseHandler>>;
  protected subscription: { abort(): void };

  constructor(props: props) {
    super(props);
    this.state   = props.state;
    this.stream  = this.context + '.' + this.module;
    this.cache   = new CachingMap('size' in props ? props.size : 100);
    this.ttl     = props.ttl > 0 ? props.ttl : null;
    this.pending = new Map();
  }

  //--

  public async start(): Promise<boolean> {
    return new Promise(resolve => super.start().then(() => {
      this.subscription = this.bus.event.subscribe(this.stream, async event => {
        const state = this.cache.get(event.id);
        if (state == null) return ;
        if (state.revision + 1 != event.number) {
          this.clear(event.id);
        } else {
          const newState = this.factory.apply(state, event);
          newState.data = new this.state(newState.data);
          this.set(event.id, newState);
        }
      });
      return resolve(true);
    }));
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => super.stop().then(async () => {
      await this.subscription.abort();
      this.cache.clear();
      return resolve();
    }));
  }

  //--

  public get(id: string): Promise<S> {
    return new Promise((resolve, reject) => {
      const localState = this.cache.get(id);
      if (localState != null) return resolve(localState);
      const pending = this.pending.get(id);
      if (pending != null) {
        pending.push({ resolve, reject });
      } else {
        this.pending.set(id, [{ resolve, reject }]);
        this.resolve(id);
      }
    });
  }

  public clear(id: string) {
    this.cache.delete(id);
    const pending = this.pending.get(id);
    if (pending == null) return ;
    while (pending.length > 0)
      pending.pop().reject(new Error('Cleared'));
  }

  protected async resolve(id: string) {
    let state = await this.bus.state.fetch(this.stream, id);
    state.data = new this.state(state.data);
    await this.bus.event.readFrom(this.stream, id, state.revision, async event => {
      state = this.factory.apply(state, event);
      state.data = new this.state(state.data);
    });
    this.set(id, state);
  }

  protected set(id: string, state: S) {
    this.cache.set(id, state, { ttl: this.ttl });
    const pending = this.pending.get(id);
    if (pending == null) {
      if (state.revision >= 0 && state.ahead > 0) {
        this.bus.state.save(state);
        state.ahead = 0;
      }
    } else {
      this.pending.delete(id);
      while (pending.length > 0)
        pending.pop().resolve(state);
    }
  }

}
