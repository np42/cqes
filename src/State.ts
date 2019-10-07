import { Event }  from './Event';
import { merge }  from './util';

export class State<A = any> {
  public stateId:   string;
  public revision:  number;
  public data:      A;

  constructor(stateId: string, revision: number, data: A) {
    this.stateId  = stateId;
    this.revision = revision >= 0 ? revision : -1;
    this.data     = data instanceof Object ? data : <A>{};
  }

  public clone(): State<A> {
    return new (<any>this.constructor)(this.stateId, this.revision, this.data);
  }

  public merge(partial?: Partial<A>): State<A> {
    const data = partial ? merge(this.data || {}, partial) : this.data;
    return new (<any>this.constructor)(this.stateId, this.revision, data);
  }

  public end(): State<A> {
    return new (<any>this.constructor)(this.stateId);
  }

}
