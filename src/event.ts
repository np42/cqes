export class event<A> {
  public name: string;
  public data: A;
  public meta: any;

  constructor(name: string, data: any = null, meta: any = null) {
    this.name = name;
    this.data = data instanceof Object ? data : {};
    this.meta = meta;
  }
}
