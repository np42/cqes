import { Serializable } from './Serializable';

export class Command extends Serializable {
  public topic:     string;
  public createdAt: Date;
  public type:      string;
  public data:      Object;
  public meta:      Object;

  constructor(topic: string, type: string, data = {}, meta = {}) {
    super();
    this.topic     = topic;
    this.createdAt = new Date();
    this.type      = type;
    this.data      = data;
    this.meta      = meta;
  }
}
