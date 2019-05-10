import { v4 as uuid } from 'uuid';

// Value
export class Value {
  public static _value = <typeof Value>null;

  public static Set() { return _Set.of(this); }
  public static Array() { return _Array.of(this); }
  public static Map(index: any) { return _Map.of(index, this); }

  public static of(model?: any, ...rest: any[]) {
    if (model && model.prototype instanceof Value) {
      return model;
    } else {
      const value = class extends this {};
      value._value = model;
      return value;
    }
  }

  public static from(data: any): any {
    if (this._value && this._value.prototype instanceof Value) {
      return this._value.from(data);
    } else {
      return null;
    }
  }

}

// Boolean
export class _Boolean extends Value {

  public static from(value: any) {
    return !!value;
  }

}

// Number
export class _Number extends Value {

  public static from(value: any) {
    if (value == null) return 0;
    return parseFloat(value);
  }

}

// String
export class _String extends Value {

  public static from(value: any) {
    if (value == null) return '';
    return String(value);
  }

}

// Enum
export class Enum extends Value {

  public static _either = new Set();

  public static of(...args: any[]) {
    const _enum = class extends this {};
    _enum._either = new Set(args);
    return _enum;
  }

  public static from(value: any) {
    if (this._either.has(value)) return value;
    return null;
  }

}

// Date
export class _Date extends Value {

  public static from(value: any) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value))
      return String(value);
    else
      return '0000-00-00';
  }

}

// Time
export class _Time extends Value {

  public static from(value: any) {
    if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?$/.test(value))
      return String(value);
    else
      return '00:00:00';
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

  public static of<T extends CRecord>(this: T, model: any): T {
    const object = class extends this {};
    object._object = {};
    for (const field in model) {
      if (model[field] instanceof Array)
        object._object[field] = Value.of(...model[field]);
      else
        object._object[field] = Value.of(model[field]);
    }
    return object;
  }

  public static add<T extends CRecord>(this: T, field: string, ...args: any[]): T {
    const object = class extends this {};
    object._object = { ...this._object };
    object._object[field] = Value.of(...args);
    return object;
  }

  public static from(data: any) {
    if (!(data && data instanceof Object)) data = {};
    const record = <any>new this();
    for (const field in this._object)
      record[field] = this._object[field].from(data[field]);
    return record;
  }

}

// Entity
export class Entity extends Record {

  public static _object = <{ [name: string]: typeof Value }>{ ID: _String };

  public static ID() { return _String; }
  public static ByID() { return _Map.of(this.ID(), this); }

  public ID: string;

  public static from(data: any) {
    if (data == null) data = {};
    if (data.ID == null) data.ID = uuid();
    return super.from(data);
  }

}

// Aggregate
export class Aggregate extends Entity {

}

// ------------------------------------------

// Set
export class _Set extends Value {

  public static _subtype = <any>null;

  public static of(type: any) {
    const set = class extends _Set {};
    set._subtype = type;
    return set;
  }

  public static from(data: any) {
    return new Set(data);
  }

  public static toJSON(this: Set<any>) {
    return Array.from(this);
  }

}

// Array
export class _Array extends Value {

  public static _subtype = <any>null;

  public static of(type: any) {
    const array = class extends this {};
    array._subtype = type;
    return array;
  }

  public static from(data: any) {
    if (data instanceof Array) {
      const array = new Array(data.length);
      for (let i = 0; i < data.length; i += 1)
        array[i] = this._subtype.from(data[i]);
      return array;
    } else {
      return [];
    }
  }

}

// Map
export class _Map extends Value {

  public static _index   = <any>null;
  public static _subtype = <any>null;

  public static of(index: any, value?: any) {
    const map = class extends this {};
    map._index = index;
    map._subtype = value;
    return map;
  }

  public static from(data: any) {
    const map = new Map();
    map.toJSON = this.toJSON;
    if (data == null) return map;
    for (const [key, value] of data)
      map.set(this._index.from(key), this._subtype.from(value));
    return map;
  }

  public static toJSON(this: Map<any, any>) {
    return Array.from(this);
  }

}
