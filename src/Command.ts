import { Event } from './Event';
import { merge } from 'cqes-util';

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

  public toEvent(type: string, data?: any, doMerge: boolean = true) {
    if (data == null)
      data = this.data;
    else if (data instanceof Array)
      data = data.reduce((result, field) => { result[field] = this.data[field]; return result; }, {})
    else if (doMerge)
      data = merge(this.data, data);
    return new Event(this.category, this.streamId, -1, type, data, this.meta);
  }

  public get stream() {
    return this.category + '-' + this.streamId;
  }
}
