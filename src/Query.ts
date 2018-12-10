import { Status, Reply } from './Reply';

export class Query {
  public view:      string;
  public method:    string;
  public createdAt: Date;
  public data:      any;
  public meta:      any;

  constructor(view: string, method: string, data: any, meta?: any) {
    this.view      = view;
    this.createdAt = new Date();
    this.method    = method || view;
    this.data      = data;
    this.meta      = meta || null;
  }

}

export type QueryReplier = (type: Status, value: any) => void;

export class InQuery extends Query {
  private reply:    QueryReplier;
  public  pulledAt: Date;
  constructor(reply: QueryReplier, view: string, method: string, data?: any, meta?: any) {
    super(view, method, data, meta);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }
  resolve(content: any) { this.reply(Status.Resolved, content); }
  reject(content: any)  { this.reply(Status.Rejected, content); }
}

export class OutQuery extends Query {
  serialize() {
    return Buffer.from(JSON.stringify(this));
  }
}
