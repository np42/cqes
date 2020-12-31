export enum EventNumber
{ Append = -1
, Error  = -3
, NoOp   = -4
};

export interface Meta {
  $persistent?: boolean; // if null then true
  $deleted?:    boolean; // if null then false
};

export class Event<A = any, B extends Meta = any> {
  public position: number;
  public category: string;
  public streamId: string;
  public number:   number;
  public type:     string;
  public data:     A;
  public meta:     B;
  public rawData:  any;

  constructor(category: string, streamId: string, number: number, type: string, data: any, meta?: any) {
    this.position = null;
    this.category = category;
    this.streamId = streamId;
    this.number   = number;
    this.type     = type;
    this.data     = data instanceof Object ? data : {};
    this.meta     = data instanceof Object ? meta : {};
  }

  public get stream() {
    return this.category + '-' + this.streamId;
  }

  public delete() {
    if (this.meta.$persistent === false) throw new Error('Must be persistent');
    this.meta.$deleted = true;
    return this;
  }

  public volatil() {
    if (this.meta.$deleted === true) throw new Error('Can not make volatil event when deleting stream');
    this.meta.$persistent = false;
    return this;
  }

};
