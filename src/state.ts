import { event }  from './event';
import merge      from './merge';

export class state<A> {
  public type:      string;
  public id:        string;
  public revision:  number;
  public data:      A;
  public events:    Array<event<any>>;

  constructor(id: string, revision?: number, data?: A) {
    this.type     = this.constructor.name;
    this.id       = id;
    this.revision = revision >= 0 ? revision : -1;
    this.data     = data || <A>{};
    this.events   = [];
  }

  get key() {
    return this.type + '-' + this.id;
  }

  public merge(partial?: Partial<A>): state<A> {
    const data = partial ? merge(this.data || {}, partial) : this.data;
    return new (<any>this.constructor)(this.id, this.revision + 1, data);
  }

  public next(): state<A> {
    return new (<any>this.constructor)(this.id, this.revision + 1, this.data);
  }

  public end(): state<A> {
    return new (<any>this.constructor)(this.id);
  }

}
