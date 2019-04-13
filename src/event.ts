export class event<A> {
  public version: string;
  public name:    string;
  public data:    A;
  public meta:    any;

  constructor(data: any = null, meta: any = null) {
    this.name = this.constructor.name;
    this.data = data instanceof Object ? data : {};
    this.meta = meta;
  }
}
