import { Serializable } from './Serializable';

export class Command extends Serializable {
  constructor(topicId, type, data, meta) {
    super();
    this.topicId   = topicId;
    this.createdAt = new Date();
    this.orderType = type;
    this.orderData = data;
    this.orderMeta = meta;
  }
}
