import { EventEmitter } from 'events';

interface Bucket<T>   { keys: Set<T>, expires: number };
interface Entry<K, V> { value: V, expires: number, bucket: Bucket<K> };

export class ExpireMap<K, V> {
  protected map:         Map<K, Entry<K, V>>;
  protected timer:       NodeJS.Timer;
  protected events:      EventEmitter;
  protected buckets:     Array<Bucket<K>>;

  constructor() {
    this.map      = new Map();
    this.timer    = null;
    this.buckets  = new Array();
    this.events   = new EventEmitter();
  }

  public get size() {
    return this.map.size;
  }

  public on(event: string, callback: (event: { key: K, value: V }) => void) {
    this.events.on(event, callback);
    return this;
  }

  public has(key: K) {
    return this.map.has(key);
  }

  public get(key: K) {
    const entry = this.map.get(key);
    if (entry == null) return undefined;
    const now   = Date.now();
    if (entry.expires < now) {
      this.map.delete(key);
      entry.bucket.keys.delete(key);
      this.events.emit('expired', { key, value: entry.value });
      return undefined;
    } else {
      return entry.value;
    }
  }

  public set(key: K, ttl: number, value: V) {
    if (!(ttl > 0 && isFinite(ttl))) throw new Error('TTL must be a positive finite number');
    const now = Date.now();
    if (this.map.has(key)) {
      const old = this.map.get(key);
      if (old.expires < now) {
        this.events.emit('expired', { key, value: old.value });
      } else {
        this.events.emit('replaced', { key, value: old.value });
      }
      old.bucket.keys.delete(key);
    }
    const expires = Math.floor(now + ttl);
    const slot = Math.floor(ttl / 1000);
    if (this.buckets[slot] != null) {
      this.buckets[slot].keys.add(key);
    } else {
      const expires = Math.floor((now + ttl + 1000) / 1000) * 1000;
      this.buckets[slot] = { expires, keys: new Set([key]) };
    }
    const bucket = this.buckets[slot];
    const entry = { value, expires, bucket };
    this.map.set(key, entry);
    if (this.timer == null) {
      this.timer = setInterval(() => this.gc(), 1000);
    }
  }

  public clear() {
    if (this.timer) clearInterval(this.timer);
    this.timer   = null;
    this.buckets = [];
    this.map.clear();
  }

  public delete(key: K) {
    if (!this.map.has(key)) return false;
    this.map.delete(key);
    if (this.map.size == 0) {
      clearInterval(this.timer);
      this.timer   = null;
      this.buckets = [];
    }
    return true;
  }

  public *entries() {
    let now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expires < now) {
        this.map.delete(key);
        entry.bucket.keys.delete(key);
        this.events.emit('expired', { key, value: entry.value });
      } else {
        yield [key, entry.value];
        now = Date.now();
      }
    }
  }

  public *keys() {
    for (const entry of this.entries())
      yield entry[0];
  }

  public *values() {
    for (const entry of this.entries())
      yield entry[1];
  }

  public forEach(callback: (value: V, key: K, map: ExpireMap<K, V>) => void, thisArg?: any) {
    if (arguments.length == 2) callback = callback.bind(thisArg);
    for (const entry of this.entries())
      callback(<V>entry[1], <K>entry[0], this);
  }

  public gc() {
    if (this.map.size == 0) return ;
    const now  = Date.now();
    let offset = 0;
    for (; offset < this.buckets.length; offset += 1) {
      const bucket = this.buckets[offset];
      if (bucket == null) continue ;
      if (now < bucket.expires) break ;
      for (const key of bucket.keys) {
        const entry = this.map.get(key);
        this.map.delete(key);
        this.events.emit('expired', { key, value: entry.value });
      }
    }
    if (this.map.size == 0) {
      this.buckets = [];
      clearInterval(this.timer);
      this.timer = null;
    } else {
      const next = this.buckets[offset];
      const slot = Math.floor((next.expires - now) / 1000);
      this.buckets.splice(0, offset - slot);
    }
  }

}

ExpireMap.prototype[Symbol.iterator] = ExpireMap.prototype.entries;