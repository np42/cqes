import { event }  from './event';
import * as merge from 'deepmerge';

const MERGE_OPTIONS = { arrayMerge: (l: any, r: any, o: any) => r };

export class state<A> {
  public type:      string;
  public id:        string;
  public revision:  number;
  public data:      A;
  public events:    Array<event<any>>;

  constructor(type: string, id: string, revision?: number, data?: A) {
    this.type     = type;
    this.id       = id;
    this.revision = revision >= 0 ? revision : -1;
    this.data     = data;
    this.events   = [];
  }

  get key() {
    return this.type + '-' + this.id;
  }

  public merge(partial?: any) {
    const data = partial ? merge(this.data || {}, partial, MERGE_OPTIONS) : this.data;
    return new state(this.type, this.id, this.revision + 1, data);
  }

  public end() {
    return new state(this.type, this.id);
  }

}
