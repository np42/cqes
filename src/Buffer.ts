import * as Component   from './Component';

import { state }        from './state';

const CachingMap = require('caching-map');

export interface props extends Component.props {
  size?:    number;
  ttl?:     number;
  storage?: string;
}

export interface children extends Component.children {}

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
  has(key: K): boolean;
  delete(key: K): void;
}

type PendingQueue = Array<(state: state<any>) => void>;

export class Buffer extends Component.Component {
  protected cache:      CachingMap<string, state<any>>;
  protected ttl:        number;

  constructor(props: props, children: children) {
    super({ type: 'buffer', ...props }, children);
    this.cache = new CachingMap('size' in props ? props.size : 100);
    this.ttl   = props.ttl > 0 ? props.ttl : null;
  }

  public get(id: string) {
    return this.cache.get(id);
  }

  public has(id: string) {
    return this.cache.has(id);
  }

  public setnx(id: string, state: state<any>): void {
    if (this.cache.has(id)) throw new Error('State already loaded');
    this.cache.set(id, state, { ttl: this.ttl });
  }

  public update(state: state<any>): Promise<void> {
    const revision = state.revision;
    const count = state.events.length;
    if (!(revision > -1)) return Promise.reject('Bad revision');
    if (state == null) return Promise.reject('Missing state');
    const oldState = this.cache.get(state.id);
    if (oldState == null) return Promise.reject('State lost');
    if (oldState.revision + count != revision) return Promise.reject('Revision missmatch');
    if (oldState === state && revision !== state.revision) return Promise.reject('Update forbidden');
    this.cache.set(state.id, state, { ttl: this.ttl });
    return Promise.resolve();
  }

}
