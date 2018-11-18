export enum Status { Resolved = 'resolve', Rejected = 'reject' }

export class Reply {
  public status: Status;
  public data:   any;
  constructor(error: string, data?: any) {
    if (error != null) {
      this.status = Status.Rejected;
      this.data = error;
    } else {
      this.status = Status.Resolved;
      this.data = data;
    }
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
    return new Buffer(JSON.stringify(this));
  }
}
