import { v4 as uuid } from 'uuid';

export class query<A = any> {
  public view:      string; // Repository Name
  public method:    string; // Procedure Name
  public data:      any;    // Payload
  public meta:      any;    // Meta Data

  constructor(view: string, method: string, data: A, meta?: any) {
    this.view      = view;
    this.method    = method || view;
    this.data      = data;
    this.meta      = meta || null;
  }

}
