import * as Component   from './Component';

import { state }        from './state';

const CachingMap = require('caching-map');

export interface props extends Component.props {
  size?:       number;
  ttl?:        number;
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
    this.cache      = new CachingMap('size' in props ? props.size : 100);
    this.ttl        = props.ttl > 0 ? props.ttl : null;
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

  public update(state: state<any>): void {
    const revision = state.revision;
    if (!(revision > -1)) throw new Error('Bad revision');
    if (state == null) throw new Error('Missing state');
    const oldState = this.cache.get(state.key);
    if (oldState == null) throw new Error('State lost');
    if (oldState.revision != revision) throw new Error('Revision missmatch');
    if (oldState === state && revision !== state.revision) throw new Error('Update forbidden');
    this.cache.set(state.id, state, { ttl: this.ttl });
  }

}
