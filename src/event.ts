import { createHash } from 'crypto';

export class event<A> {
  public version: string;
  public name:    string;
  public data:    A;
  public meta:    any;

  constructor(data: any = null, meta: any = null) {
    this.version = createHash('md5').update(this.constructor.toString()).digest('hex').substr(0, 8);
    this.name = this.constructor.name;
    this.data = data instanceof Object ? data : {};
    this.meta = meta;
  }
}
