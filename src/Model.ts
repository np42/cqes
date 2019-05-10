import { v4 as uuid } from 'uuid';

// Value
export class Value {
  public static _value = <typeof Value>null;

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

  public static parse(data: any): any {
    if (this._value && this._value.prototype instanceof Value) {
      return this._value.parse(data);
    } else {
      return null;
    }
  }

}

// Boolean
export class _Boolean extends Value {

  public static parse(value: any) {
    return !!value;
  }

}

// Number
export class _Number extends Value {

  public static parse(value: any) {
    return parseFloat(value);
  }

}

// String
export class _String extends Value {

  public static parse(value: any) {
    return String(value);
  }

}

// Enum
export class Enum extends Value {

  public static _either = new Set();

  public static parse(value: any) {
    if (this._either.has(value)) return value;
    return null;
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

//----------------------------------------------------------

// Record
interface CRecord {
  new (...a: any[]): Record;
  _object: { [name: string]: typeof Value };
}

export class Record extends Value {

  public static _object = <{ [name: string]: typeof Value }>{};

  public static from<T extends CRecord>(this: T, model: any): T {
    const object = class extends this {};
    object._object = {};
    for (const field in model) {
      if (model[field] instanceof Array)
        object._object[field] = Value.from(...model[field]);
      else
        object._object[field] = Value.from(model[field]);
    }
    return object;
  }

  public static add<T extends CRecord>(this: T, field: string, ...args: any[]): T {
    const object = class extends this {};
    object._object = { ...this._object };
    object._object[field] = Value.from(...args);
    return object;
  }

  public static parse(data: any) {
    if (!(data && data instanceof Object)) data = {};
    const record = <any>new this();
    for (const field in this._object)
      record[field] = this._object[field].parse(data[field]);
    return record;
  }

}

// Entity

export class Entity extends Record {

  public static _object = <{ [name: string]: typeof Value }>{ ID: _String };

  public static ID() { return _String; }

  public ID: string;

  public static parse(data: any) {
    if (data == null) data = {};
    if (data.ID == null) data.ID = uuid();
    return super.parse(data);
  }

}

// Aggregate
export class Aggregate extends Entity {

}

// ------------------------------------------

// Set
export class _Set extends Value {

  public static _subtype = <any>null;

  public static parse(data: any) {
    return new Set(data);
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

  public static parse(data: any) {
    return new Array(data);
  }

  public static from(type: any) {
    const array = class extends this {};
    array._subtype = type;
    return array;
  }

}

// Map
export class _Map extends Value {

  public static _index   = <any>null;
  public static _subtype = <any>null;

  public static parse(data: any) {
    const map = new Map();
    if (data == null) return map;
    for (const [key, value] of data) {
      debugger;
      map.set(this._index.parse(key), this._subtype.parse(value));
    }
    return new Map(map);
  }

  public static from(index: any, value?: any) {
    const map = class extends this {};
    map._index = index;
    map._subtype = value;
    return map;
  }

}
