import { v4 as uuid } from 'uuid';

export class query<A = any> {
  public view:      string; // Repository Name
  public id:        string; // Partition ID
  public method:    string; // Procedure Name
  public createdAt: Date;   // Requested Date
  public data:      any;    // Payload
  public meta:      any;    // Meta Data

  constructor(view: string, id: string, method: string, data: A, meta?: any) {
    this.view      = view;
    this.id        = id;
    this.method    = method || view;
    this.data      = data;
    this.meta      = meta || null;
  }

}
