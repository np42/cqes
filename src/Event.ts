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

  get entityId() {
    return this.stream.substr(this.stream.indexOf('-') + 1);
  }

}

export class InEvent<D extends EventData> extends Event<D> {
  public createdAt: Date;
  constructor(stream: string, type: string, data?: D, meta?: any) {
    super(stream, type, data, meta);
    this.createdAt = new Date();
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
