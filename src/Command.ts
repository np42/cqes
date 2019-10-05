export class Command<A = any> {
  public category:  string;
  public streamId:  string;
  public order:     string;
  public createdAt: Date;
  public data:      A;
  public meta:      any;

  constructor(category: string, streamId: string, order: string, data?: A, meta?: any) {
    this.category  = category;
    this.streamId  = streamId;
    this.data      = data;
    this.meta      = meta;
    this.order     = order;
    this.createdAt = new Date();
  }

}
