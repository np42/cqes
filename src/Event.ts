export class Event<A = any> {
  public position: number;
  public category: string;
  public streamId: string;
  public number:   number;
  public type:     string;
  public data:     A;
  public meta:     any;
  public rawData:  any;

  constructor(category: string, streamId: string, number: number, type: string, data: any, meta?: any) {
    this.position = null;
    this.category = category;
    this.streamId = streamId;
    this.number   = number;
    this.type     = type;
    this.data     = data instanceof Object ? data : {};
    this.meta     = meta;
  }

  public get stream() {
    return this.category + '-' + this.streamId;
  }

}
