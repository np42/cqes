import { Serializable } from './Serializable';

export enum Type { Resolved = 'resolve', Rejected = 'reject' }

export class Reply extends Serializable {
  public type: Type;
  public value: Object;

  constructor(type: Type, value: Object) {
    super();
    this.type  = type || Type.Rejected;
    this.value = value || {};
  }
}
