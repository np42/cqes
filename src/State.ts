import { merge, clone } from 'cqes-util';

export enum StateRevision
{ New    = -1
, Delete = -2
};

export class State<A = any> {
  public stateId:   string;
  public revision:  number;
  public version:   string;
  public data:      A;

  constructor(stateId: string, revision: number, version: string, data: A) {
    this.stateId  = stateId;
    this.revision = revision >= 0 ? revision : StateRevision.New;
    this.version  = version;
    this.data     = data instanceof Object ? data : <A>{};
  }

  public isNew() {
    return this.revision < 0;
  }

  public exists() {
    return this.revision >= 0;
  }

  public clone(): State<A> {
    return new (<any>this.constructor)(this.stateId, this.revision, this.version, clone(this.data));
  }

  public end(): State<A> {
    return new (<any>this.constructor)(this.stateId, StateRevision.Delete, this.version, null);
  }

}
