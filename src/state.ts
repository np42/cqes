import { event }  from './event';
import { merge }  from './merge';

export class state<A = any> {
  public stream:    string;
  public id:        string;
  public revision:  number;
  public data:      A;
  public ahead:     number;

  constructor(stream: string, id: string, revision: number, data: A) {
    this.stream   = stream;
    this.id       = id;
    this.revision = revision >= 0 ? revision : -1;
    this.data     = data || <A>{};
    this.ahead    = 0;
  }

  get key() {
    return this.stream + '-' + this.id;
  }

  public merge(partial?: Partial<A>): state<A> {
    const data = partial ? merge(this.data || {}, partial) : this.data;
    const state = new (<any>this.constructor)(this.stream, this.id, this.revision + 1, data);
    state.ahead = this.ahead + 1;
    return state;
  }

  public next(): state<A> {
    const state = new (<any>this.constructor)(this.stream, this.id, this.revision + 1, this.data);
    state.ahead = this.ahead + 1;
    return state;
  }

  public end(): state<A> {
    const state = new (<any>this.constructor)(this.stream, this.id);
    state.ahead = this.ahead + 1;
    return state;
  }

}
