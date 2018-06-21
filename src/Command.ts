import { Serializable } from './Serializable';

export class Command<D> extends Serializable {
  public topic:     string;
  public createdAt: Date;
  public type:      string;
  public data:      D;
  public meta:      Object;

  constructor(topic: string, type: string, data?: D, meta?: Object) {
    super();
    this.topic     = topic;
    this.createdAt = new Date();
    this.type      = type;
    this.data      = data;
    this.meta      = meta;
  }
}
