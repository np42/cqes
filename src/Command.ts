class Command<D> {
  public topic:     string;
  public createdAt: Date;
  public name:      string;
  public data:      D;
  public meta:      Object;

  constructor(topic: string, name: string, data: D, meta: Object) {
    this.topic     = topic;
    this.createdAt = new Date();
    this.name      = name;
    this.data      = data;
    this.meta      = meta;
  }
}

export type CommandReplier = (action: string) => void;

export class InCommand<D> extends Command<D> {
  private reply:    CommandReplier;
  public  pulledAt: Date;
  constructor(reply: CommandReplier, topic: string, name: string, data?: D, meta?: Object) {
    super(topic, name, data, meta);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }
  ack()    { this.reply('ack'); }
  nack()   { this.reply('nack'); }
  cancel() { this.reply('cancel'); }
}

export class OutCommand<D> extends Command<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
