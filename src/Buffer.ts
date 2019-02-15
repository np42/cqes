import * as Component   from './Component';

import * as Repository  from './Repository';

import { State }        from './State';
import { Event }        from './Event';
import { Query }        from './Query';
import { Reply }        from './Reply';

const CachingMap = require('caching-map');

export interface Props extends Component.Props {
  size?:       number;
  ttl?:        number;
  Repository?: Repository.Props;
}

export interface Children extends Component.Children {
  Repository: { new(props: Repository.Props, children: Repository.Children): Repository.Repository };
}

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
  delete(key: K): void;
}

interface Entry {
  state: State;
  queue: PendingQueue;
}

type PendingQueue = Array<(state: State) => void>;

export class Buffer extends Component.Component {
  protected cache:      CachingMap<string, Entry>;
  protected ttl:        number;
  public    repository: Repository.Repository;

  constructor(props: Props, children: Children) {
    super({ type: 'Buffer', ...props }, children);
    this.cache      = new CachingMap('size' in props ? props.size : 100);
    this.ttl        = props.ttl > 0 ? props.ttl : null;
    this.repository = this.sprout('Repository', Repository);
  }

  public get(key: string): Promise<State> {
    return new Promise(resolve => {
      const entry = this.cache.get(key);
      if (entry != null) {
        if (entry.state != null && entry.queue.length == 0)
          return resolve(entry.state);
        entry.queue.push(resolve);
      } else {
        const entry = { state: <State>null, queue: <PendingQueue>[] };
        this.cache.set(key, entry);
        this.repository.load(key).then((state: State) => {
          entry.state = state;
          resolve(state);
        });
      }
    });
  }

  public drain(key: string) {
    const entry = this.cache.get(key);
    if (entry == null) return ;
    if (entry.queue.length === 0) return ;
    return entry.queue.shift()(entry.state);
  }

  public update(guessVersion: number, state: State, events: Array<Event>): Promise<void> {
    return new Promise((resolve, reject) => {
      const entry = this.cache.get(state.key);
      const key   = state.key;
      if (entry == null)
        return reject(new Error('Entry not found: ' + key));
      const version = entry.state.version;
      if (version != guessVersion)
        return reject(new Error('State has changed, expected: ' + version + ' got: ' + guessVersion));
      if (state.version > -1) {
        entry.state = state;
        this.cache.set(key, entry, { ttl: this.ttl });
      } else {
        this.cache.delete(key);
      }
      this.repository.save(state, events).then(resolve);
    });
  }

  //--

  public resolve(query: Query): Promise<Reply> {
    return this.repository.resolve(query, <any>this.cache);
  }

  //--

  public start(): Promise<boolean> {
    return this.repository.start();
  }

  public stop(): Promise<void> {
    return this.repository.stop();
  }

}
