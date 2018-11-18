export class Translator<P, R> {
  constructor(config: Translator<P, R>) {
    if (typeof config.decode == 'function') this.decode = config.decode;
    if (typeof config.encode == 'function') this.encode = config.encode;
  }
  decode(obj: P): any { return obj }
  encode(obj: any): R { return obj }
}
