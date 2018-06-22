class State<D> {
  public process:   string;
  public versions:  Map<string, any>;
  public data:      D;
  public meta:      Object;

  constructor(process: string, versions: Map<string, any>, data?: D, meta?: Object) {
    this.process  = process;
    this.versions = versions
    this.data     = data;
    this.meta     = meta;
  }

}

export class InState<D> extends State<D> {
  public createdAt: Date;
  constructor(process: string, versions: Map<string, any>, data?: D, meta?: Object) {
    super(process, versions, data, meta);
    this.createdAt = new Date();
  }
}

export class OutState<D> extends State<D> {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
