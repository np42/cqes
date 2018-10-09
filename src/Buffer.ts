import { Entity, EntityClass } from './Aggregate';

export interface Options<E> {
  size:    number;
  onGc:    (key: string, number: number, data: E, longevity?: number) => void
  onFetch: (key: string) => Promise<{ number: number, data: E }>;
}

export enum Status { Atlered, Released }

export interface Item<T> {
  status: Status;
  number: number;
  date:   number;
  data:   T;
}

export class Buffer<E> {

  protected Item:    { new(date?: any): E };
  protected map:     Map<string, Item<E>>;
  protected onFetch: (key: string) => Promise<{ number: number, data: E }>;
  protected onGc:    (key: string, number: number, data: E, longevity?: number) => void;

  constructor(Item: { new(date?: any): E }, options?: Options) {
    if (options == null) options = {};
    this.map  = new Map();
    this.list = new Set();
    this.size = options.size > 0 ? options.size : 1000;
    this.Item = Item;
    if (options.onFetch) this.onFetch = options.onFetch;
    if (options.onGc)    this.onGc    = options.onGc;
  }

  public async get(key: string): Promise<Item<E>> {
    let item = this.map.get(key);
    item = this.fetch(key, item);
    this.map.delete(key);
    this.map.set(key, item);
    return item;
  }

  public set(key: string, number: number, data: E): void {
    const now = Date.now();
    const item = { status: Status.Altered, number, date: now, data };
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.size) {
      let oldKey, oldItem = null;
      for ([oldKey, oldItem] of this.map) break ;
      if (item.status == Status.Altered && this.onGc)
        this.onGc(oldKey, oldItem.number, oldItem.data, now - oldItem);
      this.map.delete(oldKey);
    }
    this.map.set(key, item);
  }

  public list(): { [key: string]: Item<E> } {
    const result = {};
    for (const [key, item] of this.map) {
      if (item.status == Status.Released) continue ;
      result[key] = item;
    }
    return result;
  }

  public release(list: { [key: string]: number }): void {
    for (const key in list) {
      const item = this.map.get(key);
      if (item.number == list[key])
        item.status = Status.Released;
    }
  }

  public async fetch(key: string):  {
    const data = this.onFetch ? await this.onFetch(key) : null;
    return new this.Item(data);
  }

}
