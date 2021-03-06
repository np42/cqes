export class Request<A = any> {
  public view:      string; // Repository Name
  public method:    string; // Procedure Name
  public data:      A;      // Payload
  public meta:      any;    // Meta Data

  constructor(view: string, method: string, data: A, meta?: any) {
    this.view      = view;
    this.method    = method;
    this.data      = data;
    this.meta      = meta;
  }

}
