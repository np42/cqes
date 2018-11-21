import { Status, Reply } from './Reply';

export class Command {
  public key:       string;
  public order:     string;
  public createdAt: Date;
  public data:      any;
  public meta:      any;

  constructor(key: string, order: string, data?: any, meta?: any) {
    this.key       = key;
    this.order     = order;
    this.createdAt = new Date();
    this.data      = data instanceof Object ? data : {};
    this.meta      = meta instanceof Object ? meta : {};
  }
}

export type CommandReplier = (action: string, reason?: any) => void;

export class InCommand extends Command {
  protected reply:    CommandReplier;
  public    pulledAt: Date;
  constructor(reply: CommandReplier, key: string, order: string, data?: any, meta?: any) {
    super(key, order, data, meta);
    this.pulledAt  = new Date();
    if (reply == null) reply = (action: string, reason?: string) => void(0);
    Object.defineProperty(this, 'reply', { value: reply });
  }
  resolve(content: any)   { this.reply(Status.Resolved, content); }
  reject(content: any)    { this.reply(Status.Rejected, content); }
  cancel(reason?: string) { this.reply('cancel', reason); }
}

export class OutCommand extends Command {
  constructor(key: string, order: string, data: any, meta?: any) {
    super(key, order, data, meta);
  }
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
