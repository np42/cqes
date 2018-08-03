class Command<D extends CommandData> {
  public topic:     string;
  public createdAt: Date;
  public name:      string;
  public data:      D;
  public meta:      any;

  constructor(topic: string, name: string, data?: D, meta?: Object) {
    this.topic     = topic;
    this.createdAt = new Date();
    this.name      = name;
    if (!(data instanceof Object)) data = <any>{};
    this.data      = data;
    if (!(meta instanceof Object)) meta = <any>{};
    this.meta      = meta;
  }
}

export type CommandReplier = (action: string, reason?: any) => void;

export class InCommand<D extends CommandData> extends Command<D> {
  protected reply:    CommandReplier;
  public    pulledAt: Date;
  constructor(reply: CommandReplier, topic: string, name: string, data?: D, meta?: Object) {
    super(topic, name, data, meta);
    this.pulledAt  = new Date();
    if (reply == null) reply = (action: string, reason?: any) => void(0);
    Object.defineProperty(this, 'reply', { value: reply });
  }
  ack()                { this.reply('ack'); }
  cancel(reason?: any) { this.reply('cancel', reason); }
}

export class OutCommand<D extends CommandData> extends Command<D> {
  constructor(topic: string, instance: D, meta?: any) {
    super(topic, instance.constructor.name, instance, meta);
  }
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}

export class CommandData { CommandDataConstraint: Symbol; }
