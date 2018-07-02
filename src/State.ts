class State<D> {
  public process:   string;
  public position:  any;
  public data:      D;
  public meta:      Object;

  constructor(process: string, position: any, data?: D, meta?: Object) {
    this.process  = process;
    this.position = position;
    this.data     = data;
    this.meta     = meta;
  }

}

export class InState<D> extends State<D> {
  public createdAt: Date;
  constructor(process: string, position: any, data?: D, meta?: Object) {
    super(process, position, data, meta);
    this.createdAt = new Date();
  }
}

export class OutState<D> extends State<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
