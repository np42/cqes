import { CommandReplier } from './Command';

class Query<D> {
  public view:      string;
  public createdAt: Date;
  public method:    string;
  public data:      D;
  public meta:      Object;

  constructor(view: string, method: string, data: D, meta: Object) {
    this.view      = view;
    this.createdAt = new Date();
    this.method    = method;
    this.data      = data;
    this.meta      = meta;
  }
}

export type QueryReplier = (type: ReplyType, value: any) => void;

export class InQuery<D> extends Query<D>{
  private reply:    QueryReplier;
  public  pulledAt: Date;
  constructor(reply: QueryReplier, view: string, method: string, data?: D, meta?: Object) {
    super(view, method, data, meta);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }
  resolve(content: any) { this.reply(ReplyType.Resolved, content); }
  reject(error: string) { this.reply(ReplyType.Rejected, error); }
}

export class OutQuery<D> extends Query<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}

export enum ReplyType { Resolved = 'resolve', Rejected = 'reject' }

class Reply<D> {
  public type:  ReplyType;
  public error: string;
  public data:  D;
  constructor(error: string, data?: D) {
    this.type = error != null ? ReplyType.Rejected : ReplyType.Resolved;
    this.error = error;
    this.data = data;
  }
}

export class InReply<D> extends Reply<D> {
  private reply:    CommandReplier;
  public  pulledAt: Date;
  constructor(reply: CommandReplier, error: string, data?: D) {
    super(error, data);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }
  ack()    { this.reply('ack'); }
  nack()   { this.reply('nack'); }
  cancel() { this.reply('cancel'); }
}

export class OutReply<D> extends Reply<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
