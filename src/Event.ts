import { Serializable } from './Serializable';

export class Event extends Serializable {
  public stream:    string;
  public createdAt: Date;
  public type:      string;
  public data:      Object;
  public meta:      Object;
  public number:    any;

  constructor(stream: string, type: string, data: Object, meta: Object) {
    super();
    this.stream    = stream;
    this.createdAt = new Date();
    this.type      = type;
    this.data      = data;
    this.meta      = meta;
    this.number    = -2;
  }

}
