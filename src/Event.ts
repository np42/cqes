import { Serializable } from './Serializable';

export class Event<D> extends Serializable {
  public stream:    string;
  public createdAt: Date;
  public type:      string;
  public data:      D;
  public meta:      Object;
  public number:    any;

  constructor(stream: string, type: string, data? : D, meta? : Object) {
    super();
    this.stream    = stream;
    this.createdAt = new Date();
    this.type      = type;
    this.data      = data;
    this.meta      = meta;
    this.number    = -2;
  }

}
