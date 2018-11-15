export class Event {
  public name: string;
  public data: any;

  constructor(name: string, data?: any) {
    this.name = name;
    this.data = data instanceof Object ? data : {};
  }
}
