import { Serializable } from './Serializable';

export class Query extends Serializable {
  public view:      string;
  public createdAt: Date;
  public method:    string;
  public data:      Object;
  public meta:      Object;

  constructor(view: string, method: string, data: Object, meta: Object) {
    super();
    this.view      = view;
    this.createdAt = new Date();
    this.method    = method;
    this.data      = data;
    this.meta      = meta;
  }
}
