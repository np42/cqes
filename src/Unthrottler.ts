import * as Component from './Component';

import { query }      from './query';
import { reply }      from './reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
  has(key: K): boolean;
}

export interface props extends Component.props {
  ttl?:   number;
}

export interface children extends Component.children {
  Item?: { new (key: string): Item<reply<any>> };
}

export class Unthrottler extends Component.Component {
  protected cache: CachingMap<string, Item<reply<any>>>;
  protected ttl:   number;
  protected Item:  { new (key: string): Item<reply<any>> };

  constructor(props: props, children: children) {
    super({ type: 'unthrottler', color: 'cyan', ...props }, children);
    this.cache = new CachingMap();
    this.ttl   = props.ttl > 0 ? props.ttl : null;
  }

  public get(query: query<any>) {
    const key = Math.random() + '';
    if (this.cache.has(key)) {
      return this.cache.get(key);
    } else {
      const item = new this.Item(key);
      this.cache.set(key, item, { ttl: this.ttl });
      return item;
    }
  }

}

export class Item<R> {
  protected key:       string;
  protected callbacks: Array<(value: R) => void>;
  protected status:    'empty' | 'running' | 'solved' | 'ready';
  protected value:     R;

  constructor(key: string) {
    this.key       = key;
    this.callbacks = [];
    this.status    = 'empty';
  }

  public get(callback: (value: R) => void) {
    if (this.status === 'ready') return callback(this.value);
    this.callbacks.push(callback);
    if (this.status === 'solved') this.rehydrate();
  }

  protected rehydrate() {
    this.status = 'running';
    this.resolve(() => Promise.resolve(this.value));
  }

  public resolve(resolver: () => Promise<R>) {
    if (this.status === 'running') return ;
    this.status = 'running';
    resolver().then((value: R) => {
      this.status = 'ready';
      this.value = value;
      this.drain();
    });
  }

  protected drain() {
    while (this.callbacks.length > 0)
      this.callbacks.shift()(this.value);
  }

}
