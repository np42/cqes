class Event<D extends EventData> {
  public stream:    string;
  public type:      string;
  public data:      D;
  public meta:      any;
  public number:    any;

  constructor(stream: string, type: string, data?: D, meta?: any) {
    this.stream = stream;
    this.type   = type;
    if (!(data instanceof Object)) data = <any>{};
    this.data   = data;
    if (!(meta instanceof Object)) meta = <any>{};
    meta.createdAt = Date.now();
    this.meta   = meta;
    this.number = -2;
  }

  get category() {
    const offset = this.stream.indexOf('-');
    return offset >= 0 ? this.stream.substr(0, offset) : this.stream;
  }

  get entityId() {
    return this.stream.substr(this.stream.indexOf('-') + 1);
  }

}

export type Replier = (action: 'ack' | 'nack', reason?: string | Error) => void;

export class InEvent<D extends EventData> extends Event<D> {
  public createdAt: Date;
  public ack: () => void;
  public cancel: (reason?: string | Error) => void;
  constructor(stream: string, type: string, data?: D, meta?: any, replier?: Replier) {
    super(stream, type, data, meta);
    this.createdAt = new Date();
    if (replier != null) {
      this.ack = () => replier('ack');
      this.cancel = (reason?: string | Error) => replier('nack', reason);
    }
  }
}

export class OutEvent<D extends EventData> extends Event<D> {
  constructor(stream: string, instance: D, meta?: any) {
    super(stream, instance.constructor.name, instance, meta);
  }
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}

export class EventData { EventDataConstraint: Symbol; }
