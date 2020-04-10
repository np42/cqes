import { Event }        from './Event';
import { merge, clone } from 'cqes-util';

export enum StateRevision
{ New    = -1
, Delete = -2
};

export class State<A = any> {
  public stateId:   string;
  public revision:  number;
  public data:      A;

  constructor(stateId: string, revision: number, data: A) {
    this.stateId  = stateId;
    this.revision = revision >= 0 ? revision : StateRevision.New;
    this.data     = data instanceof Object ? data : <A>{};
  }

  public isNew() {
    return this.revision === StateRevision.New;
  }

  public clone(): State<A> {
    return new (<any>this.constructor)(this.stateId, this.revision, clone(this.data));
  }

  public merge(partial?: Partial<A>): State<A> {
    const data = partial ? merge(this.data || {}, partial) : this.data;
    return new (<any>this.constructor)(this.stateId, this.revision, data);
  }

  public end(): State<A> {
    return new (<any>this.constructor)(this.stateId, StateRevision.Delete);
  }

}
