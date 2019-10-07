import { Event } from './Event';

export class Command<A = any> {
  public category:  string;
  public streamId:  string;
  public order:     string;
  public data:      A;
  public meta:      any;

  constructor(category: string, streamId: string, order: string, data?: any, meta?: any) {
    this.category  = category;
    this.streamId  = streamId;
    this.order     = order;
    this.data      = data instanceof Object ? data : {};
    this.meta      = { ...meta, createdAt: new Date() };
  }

  toEvent(type: string) {
    return new Event(this.category, this.streamId, -1, type, this.data, this.meta);
  }

}
