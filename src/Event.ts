export class Event {
  public name: string;
  public data: any;
  public meta: any;

  constructor(name: string, data: any = null, meta: any = null) {
    this.name = name;
    this.data = data instanceof Object ? data : {};
    this.meta = meta;
  }
}
