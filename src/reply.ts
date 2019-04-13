import { state } from './state';

export enum Status { Resolved = 'resolve', Rejected = 'reject' }

export class reply<A> {
  public status: Status;
  public data:   any;

  constructor(data?: A, error?: any) {
    if (data != null) {
      this.status = Status.Resolved;
      this.data   = data instanceof state ? data.data : data;
    } else {
      this.status = Status.Rejected;
      this.data   = error;
    }
  }

  assert(): A {
    if (this.status == Status.Rejected) throw this.data;
    return this.data;
  }

  get(): A {
    if (this.status == Status.Rejected) return null;
    return this.data;
  }
}
