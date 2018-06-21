class Event<D> {
  public stream:    string;
  public createdAt: Date;
  public type:      string;
  public data:      D;
  public meta:      Object;
  public number:    any;

  constructor(stream: string, type: string, data? : D, meta? : Object) {
    this.stream    = stream;
    this.createdAt = new Date();
    this.type      = type;
    this.data      = data;
    this.meta      = meta;
    this.number    = -2;
  }

}

export class InEvent<D> extends Event<D> {}

export class OutEvent<D> extends Event<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}