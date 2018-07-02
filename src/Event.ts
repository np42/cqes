class Event<D> {
  public stream:    string;
  public type:      string;
  public data:      D;
  public meta:      any;
  public number:    any;

  constructor(stream: string, type: string, data? : D, meta? : Object) {
    this.stream = stream;
    this.type   = type;
    this.data   = data;
    this.meta   = meta;
    this.number = -2;
  }

}

export class InEvent<D> extends Event<D> {
  public createdAt: Date;
  constructor(stream: string, type: string, data?: D, meta?: Object) {
    super(stream, type, data, meta);
    this.createdAt = new Date();
  }
}

export class OutEvent<D> extends Event<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
