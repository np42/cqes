import { v4 as uuid } from 'uuid';

const model_t = Symbol('Model');

// Value
export interface IValue {
  new (): this;
  (): void;
  _value: any;
  _optional: boolean;
  _checks: Array<any>;
  _cleaners: Array<any>;
  defineProperty(name: string, value: any, isGetter?: boolean): void;
  Set: ISet;
  Array: IArray;
  Map(index: any): IMap;
  extends(type: Function): this;
  of(...a: any[]): this;
  addCheck(check: any): this;
  opt(): this;
  from(data: any): any;
}

export const Value = <IValue>function Value() {};
Value[model_t] = true;
Value.defineProperty = function (name: string, value: any, isGetter?: boolean) {
  if (isGetter) {
    if (typeof value === 'function' && value.length === 0) {
      const indirection = '__get_' + name;
      Object.defineProperty(this, indirection, { value, enumerable: true, writable: true });
      if (!(name in this)) {
        Object.defineProperty(this, name, { get: function () {
          return this[indirection]();
        }, enumerable: true });
      }
    } else {
      throw new Error('Getters must be function without argument');
    }
  } else {
    Object.defineProperty(this, name, { value, enumerable: true, writable: true });
  }
}

Value.defineProperty('_value', null);
Value.defineProperty('_optional', false);
Value.defineProperty('_checks', new Array());
Value.defineProperty('_cleaners', new Array());

Value.defineProperty('Set', function () { return _Set.of(this) }, true);
Value.defineProperty('Array', function () { return _Array.of(this) }, true);
Value.defineProperty('Map', function (index: any) {
  return _Map.of(index, this);
});

Value.defineProperty('extends', function (constructor: Function) {
  const value = constructor;
  value[model_t] = true;
  for (let key in this) {
    const property = Object.getOwnPropertyDescriptor(this, key);
    if ('value' in property) {
      switch (Object.prototype.toString.call(property.value)) {
      case '[object Array]': { value[key] = Array.from(this[key]); } break ;
      case '[object Set]':   { value[key] = new Set(this[key]); } break ;
      case '[object Map]':   { value[key] = new Map(this[key]); } break ;
      default: { Object.defineProperty(value, key, property); } break ;
      }
    } else {
      Object.defineProperty(value, key, property);
    }
  }
  return value;
});

Value.defineProperty('clone',  function (modifier?: (a: any) => any) {
  const holder = { [this.name]: function () {} };
  const value = this.extends(holder[this.name]);
  if (modifier) modifier(value);
  return value;
});

Value.defineProperty('of', function (model?: any, ...rest: any[]) {
  if (model && model[model_t]) return model;
  return this.clone((value: IValue) => value._value = model);
});

Value.defineProperty('opt', function () {
  return this.clone((value: IValue) => value._optional = true);
});

Value.defineProperty('addCleaner', function (cleaner: (a: any) => any) {
  return this.clone((value: IValue) => value._cleaners.push(cleaner));
});

Value.defineProperty('addCheck', function (check: any) {
  return this.clone((value: IValue) => {
    if (typeof check === 'function')
      value._checks.push({ test: check });
    else if (check && typeof check.test === 'function')
      value._checks.push(check);
    else
      value._checks.push({ test: (value: any) => value === check });
  });
});

Value.defineProperty('from', function (value: any) {
  return this._value ? this._value.from(value) : null;
});

Value.defineProperty('default', function (value?: () => any) {
  return this._optional ? null : (value || null) && value();
});

Value.defineProperty('validate', function (value: any) {
  for (let i = 0; i < this._cleaners.length; i += 1)
    value = this._cleaners[i].call(this, value);
  for (let i = 0; i < this._checks.length; i += 1) {
    if (!this._checks[i].test(value))
      throw new Error('value "' + value + '"do not satisfy checks');
  }
  return value;
});

// Boolean
export interface IBoolean extends IValue {
  _true: Set<string>;
  _false: Set<string>;
}

export const _Boolean = <IBoolean>Value.extends(function Boolean() {})
  .addCheck((v: any) => v === !!v);
_Boolean.defineProperty('_true', new Set(['y', 'yes', 'true']));
_Boolean.defineProperty('_false', new Set(['n', 'no', 'false']));

_Boolean.defineProperty('from', function (value: any) {
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
});

// Number
export interface INumber extends IValue {}

export const _Number = <INumber>Value.extends(function Number() {});

_Number.defineProperty('from', function (value: any) {
  if (value == null) return this.default(() => 0);
  return this.validate(parseFloat(value));
});

// String
export interface IString extends IValue {}

export const _String = <IString>Value.extends(function String() {});

_String.defineProperty('from', function (value: any) {
    if (value == null) return this.default();
    return this.validate(String(value));
});

_String.defineProperty('default', function () {
  return '';
});

// Email
export interface IEmail extends IString {}

export const _Email = <IEmail>_String.extends(function Email() {})
  .addCheck(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/);

// Date
export interface IDate extends IString {}

export const _Date = <IDate>_String.extends(function Date() {})

_Date.defineProperty('from', function (value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(0, 10));
  else if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
});

_Date.defineProperty('default', function () {
  return '0000-00-00';
});

// Time
export interface ITime extends IString {}

export const _Time = <ITime>_String.extends(function Time() {});

_Time.defineProperty('from', function (value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(11, 12));
  if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
});

_Time.defineProperty('default', function () {
  return '00:00:00';
});

//----------------------------------------------------------

// ID
export interface IID extends IValue {}

export const ID = <IID>Value.extends(function ID() {});

ID.defineProperty('from', function (value: any) {
  if (typeof value === 'number' && value > 0) return this.validate(value);
  if (typeof value === 'string' && value.length > 0) return this.validate(value);
  if (value && value.ID) return this.from(value.ID);
  return this.default(() => uuid());
});

// Enum
export interface IEnum extends IValue {
  _either: Set<IValue>;
}

export const Enum = <IEnum>Value.extends(function Enum() {});
Enum.defineProperty('_either', new Set());

Enum.defineProperty('of', function (...args: any[]) {
  return this.clone((value: IEnum) => value._either = new Set(args));
});

Enum.defineProperty('from', function (value: any) {
  if (this._either.has(value)) return this.validate(value);
  return this.default(() => this._either.values().next().value);
});

// Record
export interface IRecord extends IValue {
  _object: Map<string, IValue>;
  add(field: string, type: any): this;
}

export const Record = <IRecord>Value.extends(function Record() {});
Record._object = new Map();

Record.defineProperty('of', function (model: { [name: string]: any }) {
  const record = this.clone();
  for (const field in model) {
    if (model[field] instanceof Array)
      record._object.set(field, Value.of(...model[field]));
    else
      record._object.set(field, Value.of(model[field]));
  }
  return record;
});

Record.defineProperty('add', function (field: string, type: any) {
  const record = this.clone();
  record._object.set(field, Value.of(type));
  return record;
});

Record.defineProperty('from', function (data: any) {
  if (data && data instanceof Object) {
    const record = <any>{};
    for (const [name, type] of this._object)
      record[name] = type.from(data[name]);
    return this.validate(record);
  } else {
    return this.default();
  }
});

Record.defineProperty('default', function () {
  return this.from({});
});

// Entity
export interface IEntity extends IRecord {
  ID: IID;
  ByID: IMap;
}

export const Entity = <IEntity>Record.extends(function Entity() {})
  .add('ID', ID);

Entity.defineProperty('ID', () => ID, true);
Entity.defineProperty('ByID', function () { return _Map.of(this.ID, this); }, true);

// Aggregate
export interface IAggregate extends IEntity {}

export const Aggregate = <IAggregate>Entity.extends(function Aggregate() {});

Aggregate.defineProperty('Set',   () => { throw new Error('Forbidden') }, true);
Aggregate.defineProperty('Array', () => { throw new Error('Forbidden') }, true);
Aggregate.defineProperty('Map',   (index: any) => { throw new Error('Forbidden') });
Aggregate.defineProperty('ByID',  () => { throw new Error('Forbidden') }, true);

// ------------------------------------------

// Set
export interface ISet extends IValue {
  _subtype: IValue;
}

export const _Set = <ISet>Value.extends(function Set() {});
_Set.defineProperty('_subtype', null);

_Set.defineProperty('of', function (type: any) {
  return this.clone((value: ISet) => value._subtype = Value.of(type));
});

_Set.defineProperty('from', function (data: any) {
  if (data != null) {
    const set = new Set(data);
    set.toJSON = this.toJSON;
    return this.validate(set);
  } else {
    return this.default();
  }
});

_Set.defineProperty('default', function () {
  const set = new Set();
  set.toJSON = this.toJSON;
  return set;
});

_Set.defineProperty('toJSON', function () {
  return Array.from(this);
});

// Array
export interface IArray extends IValue {
  _subtype: IValue;
}

export const _Array = <IArray>Value.extends(function Array() {});
_Array.defineProperty('_subtype', null);

_Array.defineProperty('of', function (type: any) {
  return this.clone((value: IArray) => value._subtype = Value.of(type));
});

_Array.defineProperty('from', function (data: any) {
    if (data instanceof Array) {
      const array = new Array(data.length);
      for (let i = 0; i < data.length; i += 1)
        array[i] = this._subtype.from(data[i]);
      return this.validate(array);
    } else {
      return this.default();
    }
});

_Array.defineProperty('default', () => new Array());

// Map
export interface IMap extends IValue {
  _index: IValue;
  _subtype: IValue;
}

export const _Map = <IMap>Value.extends(function Map() {});
_Map.defineProperty('_index', null);
_Map.defineProperty('_subtype', null);

_Map.defineProperty('of', function (index: any, type: any) {
  return this.clone((value: IMap) => {
    value._index = Value.of(index);
    value._subtype = Value.of(type);
  });
});

_Map.defineProperty('from', function (data: any) {
  const map = new Map();
  map.toJSON = this.toJSON;
  if (data == null) return this.default();
  for (const [key, value] of data)
    map.set(this._index.from(key), this._subtype.from(value));
  return this.validate(map);
});

_Map.defineProperty('default', function () {
  const map = new Map();
  map.toJSON = this.toJSON;
  return map;
});

_Map.defineProperty('toJSON', function () {
  return Array.from(this);
});
