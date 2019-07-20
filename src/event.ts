export class event<A = any> {
  public position: number;
  public stream:   string;
  public id:       string;
  public number:   number;
  public name:     string;
  public data:     A;
  public meta:     any;

  constructor(stream: string, id: string, number: number, name: string, data: any, meta: any) {
    this.position = null;
    this.stream   = stream;
    this.id       = id;
    this.number   = number;
    this.name     = name;
    this.data     = data instanceof Object ? data : {};
    this.meta     = meta;
  }

}
