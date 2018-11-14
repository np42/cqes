export class Query {
  public view:      string;
  public createdAt: Date;
  public method:    string;
  public data:      any;
  public meta:      any;

  constructor(view: string, method: string, data: any, meta?: any) {
    this.view      = view;
    this.createdAt = new Date();
    this.method    = method;
    this.data      = data;
    this.meta      = meta || null;
  }
}

export type QueryReplier = (type: ReplyType, value: any) => void;

export class InQuery extends Query {
  private reply:    QueryReplier;
  public  pulledAt: Date;
  constructor(reply: QueryReplier, view: string, method: string, data?: any, meta?: any) {
    super(view, method, data, meta);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }
  resolve(content: any) { this.reply(ReplyType.Resolved, content); }
  reject(error: string) { this.reply(ReplyType.Rejected, error); }
}

export class OutQuery extends Query {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}

export enum ReplyType { Resolved = 'resolve', Rejected = 'reject' }

export class Reply {
  public type:  ReplyType;
  public error: string;
  public data:  any;
  constructor(error: string, data?: any) {
    this.type = error != null ? ReplyType.Rejected : ReplyType.Resolved;
    this.error = error;
    this.data = data;
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
