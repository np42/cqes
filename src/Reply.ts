export enum Status { Resolved = 'resolve', Rejected = 'reject' }

export class Reply {
  public status: Status;
  public data:   any;
  public meta:   any;

  constructor(error: string, data?: any, meta?: any) {
    if (error != null) {
      this.status = Status.Rejected;
      this.data   = error;
      this.meta   = meta;
    } else {
      this.status = Status.Resolved;
      this.data   = data;
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

export class InReply extends Reply {
  public  pulledAt: Date;
  constructor(error: string, data?: any) {
    super(error, data);
    this.pulledAt  = new Date();
  }
}

export class OutReply extends Reply {
  serialize() {
    return Buffer.from(JSON.stringify(this));
  }
}
