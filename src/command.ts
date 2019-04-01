export class command<A> {
  public type:      string;
  public id:        string;
  public order:     string;
  public createdAt: Date;
  public data:      A;
  public meta:      any;

  constructor(type: string, id: string, order: string, data?: A, meta?: any) {
    this.type = type;
    this.id   = id;
    this.data = data;
    this.meta = meta;
    this.order     = order;
    this.createdAt = new Date();
  }

  get key() {
    return this.type + '-' + this.id;
  }

}
