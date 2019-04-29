import { v4 as uuid } from 'uuid';

export class query<A = any> {
  public view:      string;
  public id:        string;
  public method:    string;
  public createdAt: Date;
  public data:      any;
  public meta:      any;

  constructor(view: string, id: string, method: string, data: A, meta?: any) {
    this.view      = view;
    this.id        = id;
    this.method    = method || view;
    this.data      = data;
    this.meta      = meta || null;
  }

}
