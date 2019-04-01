import { state } from './state';

export enum Status { Resolved = 'resolve', Rejected = 'reject' }

export class reply<A> {
  public status: Status;
  public data:   any;
  public meta:   any;

  constructor(error: string, data?: A, meta?: any) {
    if (error != null) {
      this.status = Status.Rejected;
      this.data   = error;
      this.meta   = meta;
    } else {
      this.status = Status.Resolved;
      this.data   = data instanceof state ? data.data : data;
      this.meta   = meta;
    }
  }

  assert() {
    if (this.status == Status.Rejected) throw this.data;
    return this.data;
  }

  get() {
    if (this.status == Status.Rejected) return null;
    return this.data;
  }
}
