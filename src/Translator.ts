export class Translator<T> {
  constructor(config: Translator<T>) {
    if (typeof config.decode == 'function') this.decode = config.decode;
    if (typeof config.encode == 'function') this.encode = config.encode;
  }
  decode(obj: T): any { return obj }
  encode(obj: any): T { return obj }
}
