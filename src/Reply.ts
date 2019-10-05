export class Reply<A = any> {
  public type: string;
  public data: A;

  constructor(type: string, data?: A) {
    this.type = type;
    this.data = data;
  }

  public is(type: string): boolean {
    return this.type === type;
  }
}
