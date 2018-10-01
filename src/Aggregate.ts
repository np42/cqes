import { v4 as uuidv4 } from 'uuid';

export class Aggregate<Data extends Entity> {
  public id:      string;
  public data:    Data;
  public version: number;
  constructor(id?: string, data?: Data, version?: number) {
    this.id      = id != null ? id : uuidv4();
    this.data    = data != null ? data : null;
    this.version = version >= 0 ? version : -1;
  }
  set(version: number, data: Data) {
    if (data == null) throw new Error('Data cannot be null');
    if (!(version >= 0)) throw new Error('Bad version number');
    this.data    = data;
    this.version = version;
  }
}

export class Entity {
  constructor(data?: any) {
  }
}

export class Value {
  constructor(data?: any) {
  }
}
