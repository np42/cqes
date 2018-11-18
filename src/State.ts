export class State {
  public version: number;
  public status:  string;
  public data:    any;

  constructor(version?: number, status?: string, data?: any) {
    this.status  = status || null;
    this.version = version >= 0 ? version : -1;
    this.data    = data || null;
  }

}

