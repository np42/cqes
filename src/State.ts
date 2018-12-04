import * as merge from 'deepmerge';

const MERGE_OPTIONS = { arrayMerge: (l: any, r: any, o: any) => r };

export class State {
  public key:     string;
  public version: number;
  public status:  string;
  public data:    any;

  constructor(key: string, version?: number, status?: string, data?: any) {
    this.key     = key;
    this.status  = status || null;
    this.version = version >= 0 ? version : -1;
    this.data    = data || null;
  }

  get id() {
    const offset = this.key.indexOf('-');
    return offset > 0 ? this.key.substr(offset + 1) : this.key;
  }

  next(status?: string, partial?: any) {
    const newStatus = status || this.status;
    const data = partial ? merge(this.data, partial, MERGE_OPTIONS) : this.data;
    return new State(this.key, this.version + 1, newStatus, data);
  }

}
