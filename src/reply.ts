export class reply<A = any> {
  public type: 'Error' | string;
  public data: A;

  constructor(type: string, data: A) {
    this.type = type;
    this.data = data;
  }

  assert(): A {
    if (this.type === 'Error') throw this.data;
    return this.data;
  }

  get(): A {
    if (this.type === 'Error') return null;
    return this.data;
  }
}
