import { v4 as uuid } from 'uuid';
import { inspect }    from 'util';

// Value
export class Value {
  public static _value = <Value>null;

  public static Set() { return _Set.from(this); }
  public static Array() { return _Array.from(this); }
  public static Map(index: any) { return _Map.from(index, this); }

  public static from(model?: any, ...rest: any[]) {
    if (model && model.prototype instanceof Value) {
      return model;
    } else {
      const value = class extends this {};
      value._value = model;
      return value;
    }
  }

  public static parse(data?: any) {
    return data;
  }

}

// Boolean
export class _Boolean extends Value {

  public static parse(value: any) {
    return super.parse(!!value);
  }

}

// Number
export class _Number extends Value {

  public static parse(value: any) {
    return super.parse(parseFloat(value));
  }

}

// String
export class _String extends Value {

  public static parse(value: any) {
    return super.parse('' + value);
  }

}

// Enum
export class Enum extends Value {

  public static _either = <Set<any>>null;

  public static parse(value: any) {
    super.parse(value);
  }

  public static from(...args: any[]) {
    const _enum = class extends this {};
    _enum._either = new Set(args);
    return _enum;
  }

}

// Date
export class _Date extends Value {

  public static parse(value: any) {
    return super.parse(value);
  }

}

// Time
export class _Time extends Value {

  public static parse(value: any) {
    return super.parse(value);
  }

}

// Set
export class _Set extends Value {

  public static _subtype = <any>null;

  public static parse(value: any) {
    return super.parse(new Set(value));
  }

  public static from(type: any) {
    const set = class extends _Set {};
    set._subtype = type;
    return set;
  }

}

// Array
export class _Array extends Value {

  public static _subtype = <any>null;

  public static parse(array: any) {
    return super.parse(new Array(array));
  }

  public static from(type: any) {
    const array = class extends this {};
    array._subtype = type;
    return array;
  }

}

// Map
export class _Map extends Value {

  public static _index = <any>null;
  public static _subtype  = <any>null;

  public static  parse(data?: any) {
    return super.parse(new Map(data));
  }

  public static from(index: any, value?: any) {
    const map = class extends this {};
    map._index = index;
    map._subtype = value;
    return map;
  }

}


//----------------------------------------------------------
// Record
class RecordInstance {

  constructor(data?: any) {
    const self   = <typeof Record>this.constructor;
    const object = self._object;
    for (const field in object) {
      if (object[field].prototype instanceof Value) {
        this[field] = (<typeof Value>object[field]).parse(data[field]);
      } else {
        this[field] = (new (<typeof Record>object[field])(data[field]));
      }
    }
  }

}

export class Record extends RecordInstance {

  public static _object = <{ [name: string]: typeof Value | typeof Record }>{};

  public static Set() { return _Set.from(this); }
  public static Array() { return _Array.from(this); }
  public static Map(index: any) { return _Map.from(index, this); }

  public static from(model: any): typeof Record {
    const object = class extends this {};
    object._object = {};
    for (const name in model)
      object._object[name] = Value.from(model[name]);
    return object;
  }

  public static add(field: string, ...args: any[]): typeof Record {
    const object = class extends this {};
    object._object = { ...this._object };
    object._object[field] = Value.from(...args);
    return object;
  }

}

// Entity

class EntityInstance extends RecordInstance {
  public ID: string;

  constructor(data?: any) {
    if (data == null) data = {};
    if (data.ID == null) data.ID = uuid();
    super(data);
  }

}

export class Entity extends EntityInstance {

  public static _object = <{ [name: string]: Value }>{ ID: <any>_String };

  public static ID() { return _String; }
  public static Set() { return _Set.from(this); }
  public static Array() { return _Array.from(this); }
  public static Map(index: any) { return _Map.from(index, this); }

  public static from(model: any): typeof Entity {
    return Record.from.call(this, model);
  }

  public static add(field: string, ...args: any[]): typeof Entity {
    debugger;
    return Record.add.call(this, field, ...args);
  }

}

// Aggregate
class AggregateInstance extends EntityInstance {

}

export class Aggregate extends AggregateInstance {
  public static _object = <{ [name: string]: Value }>{ ID: <any>_String };

  public static ID() { return _String; }

  public static from(model: any): typeof Aggregate {
    return Entity.from.call(this, model);
  }

  public static add(field: string, ...args: any[]): typeof Aggregate {
    return Entity.add.call(this, field, ...args);
  }

}

