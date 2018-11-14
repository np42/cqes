export class State {
  public version: number;
  public data:    any;

  constructor(version?: any, data?: any) {
    this.version = version >= 0 ? version : -1;
    this.data = data instanceof Object ? data : {};
  }

}

