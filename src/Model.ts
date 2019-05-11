import { v4 as uuid } from 'uuid';

// Value
export class Value {
  public static _value    = <typeof Value>null;
  public static _optional = false;
  public static _checks   = <Array<{ test: (a: any) => boolean }>>[];
  public static _cleaners = <Array<(a: any) => any>>[];

  public static get Set() { return _Set.of(this); }
  public static get Array() { return _Array.of(this); }
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

  public static clone() {
    const value = class extends this {};
    value._value    = this._value;
    value._optional = this._optional;
    value._checks   = Array.from(this._checks);
    value._cleaners = Array.from(this._cleaners);
    return value;
  }

  public static get opt() {
    const value = this.clone();
    value._optional = true;
    return value;
  }

  public static addClener(cleaner: (a: any) => any) {
    const value = this.clone();
    value._cleaners.push(cleaner);
    return value;
  }

  public static addCheck(check: any) {
    const value = this.clone();
    if (typeof check === 'function')
      value._checks.push({ test: check });
    else if (check && typeof check.test === 'function')
      value._checks.push(check);
    else
      value._checks.push({ test: value => value === check });
    return value;
  }

  public static from(data: any): any {
    if (this._value && this._value.prototype instanceof Value) {
      return this._value.from(data);
    } else {
      return null;
    }
  }

  public static default(value?: () => any) {
    return this._optional ? null : value && value();
  }

  public static validate(value: any) {
    for (let i = 0; i < this._cleaners.length; i += 1)
      value = this._cleaners[i].call(this, value);
    for (let i = 0; i < this._checks.length; i += 1) {
      if (!this._checks[i].test(value))
        throw new Error('value "' + value + '"do not satisfy checks');
    }
    return value;
  }

}

// Boolean
export class _Boolean extends Value.addCheck((v: any) => v === !!v)
{
  public static _true = new Set(['y', 'yes', 'true']);
  public static _false = new Set(['n', 'no', 'false']);

  public static from(value: any) {
    if (value == null) return this.default(() => false);
    switch (typeof value) {
    case 'string': {
      if (this._true.has(value.toLowerCase())) return this.validate(true);
      if (this._false.has(value.toLowerCase())) return this.validate(false);
    } break ;
    case 'number': {
      return this.validate(!isNaN(value) && value !== 0);
    } break ;
    default: {
      return this.validate(value);
    } break ;
    }
  }

}

// Number
export class _Number extends Value {

  public static from(value: any) {
    if (value == null) return this.default(() => 0);
    return this.validate(parseFloat(value));
  }

}

// String
export class _String extends Value {

  public static from(value: any) {
    if (value == null) return this.default();
    return this.validate(String(value));
  }

  public static default() {
    return super.default(() => "");
  }
}

export class Email extends _String.addCheck(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/) {}

// ID
export class ID extends Value {

  public static from(value: any): number | string {
    if (typeof value === 'number' && value > 0) return this.validate(value);
    if (typeof value === 'string' && value.length > 0) return this.validate(value);
    if (value && value.ID) return this.from(value.ID);
    return this.default(() => uuid());
  }

}

// Date
export class _Date extends Value {

  public static from(value: any) {
    if (value instanceof Date)
      return this.validate(value.toISOString().substr(0, 10));
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value))
      return this.validate(String(value));
    else
      return this.default(() => '0000-00-00');
  }

}

// Time
export class _Time extends Value {

  public static from(value: any) {
    if (value instanceof Date)
      return this.validate(value.toISOString().substr(11, 12));
    if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?$/.test(value))
      return this.validate(String(value));
    else
      return this.default(() => '00:00:00');
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
    if (this._either.has(value)) return this.validate(value);
    return this.default(() => this._either.values().next().value);
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

  public static add<T extends CRecord>(this: T, field: string, type: any): T {
    const object = class extends this {};
    object._object = { ...this._object };
    object._object[field] = Value.of(type);
    return object;
  }

  public static from(data: any): Record {
    if (data && data instanceof Object) {
      const record = new this();
      for (const field in this._object)
        record[field] = this._object[field].from(data[field]);
      return this.validate(record);
    } else {
      return this.default(() => this.from({}));
    }
  }

}

// Entity
export class Entity extends Record {

  public static _object = <{ [name: string]: typeof Value }>{ ID };

  public static get ID() { return ID; }
  public static get ByID() { return _Map.of(this.ID, this); }

  public ID: string;

  public static from(data: any) {
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
    if (data != null) {
      const set = new Set(data);
      set.toJSON = this.toJSON;
      return this.validate(set);
    } else {
      return this.default(() => new Set());
    }
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
      return this.validate(array);
    } else {
      return this.default(() => []);
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
    if (data == null) return this.default(() => map);
    for (const [key, value] of data)
      map.set(this._index.from(key), this._subtype.from(value));
    return this.validate(map);
  }

  public static toJSON(this: Map<any, any>) {
    return Array.from(this);
  }

}
