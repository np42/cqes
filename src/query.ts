import { v4 as uuid } from 'uuid';

export class query<A> {
  public view:      string;
  public method:    string;
  public createdAt: Date;
  public data:      any;
  public meta:      any;

  constructor(view: string, method: string, data: A, meta?: any) {
    this.view      = view;
    this.method    = method || view;
    this.data      = data;
    this.meta      = meta || null;
  }

}
