import { v4 as uuid } from 'uuid';

const xModel = Symbol('Model');

// Value
export interface IValue {
  new (): this;
  (): void;
  _value: any;
  _optional: boolean;
  _checks: Array<any>;
  _cleaners: Array<any>;
  Set: ISet;
  __get_Set(): ISet;
  Array: IArray;
  __get_Array: IArray;
  Map(index: any): IMap;
  extends(type: Function): this;
  of(...a: any[]): this;
  addCheck(check: any): this;
  opt(): this;
  from(data: any): any;
}

export const Value = <IValue>function Value() {};
Value[xModel]   = true;
Value._value    = null;
Value._optional = false;
Value._checks   = <any[]>new Array();
Value._cleaners = <any[]>new Array();

Object.defineProperty(Value, 'Set', { get: function () {
  return this.__get_Set();
}, enumerable: true });
Object.defineProperty(Value, '__get_Set', { value: function () {
  return _Set.of(this);
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'Array', { get: function () {
  return this.__get_Array();
}, enumerable: true });
Object.defineProperty(Value, '__get_Array', { value: function () {
  return _Array.of(this);
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'Map', { value: function (index: any) {
  return _Map.of(index, this);
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'extends', { value: function (constructor: Function) {
  const value = constructor;
  value[xModel] = true;
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
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'clone', { value: function (modifier?: (a: any) => any) {
  const holder = { [this.name]: function () {} };
  const value = this.extends(holder[this.name]);
  if (modifier) modifier(value);
  return value;
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'of', { value: function (model?: any, ...rest: any[]) {
  if (model && model[xModel]) return model;
  return this.clone((value: IValue) => value._value = model);
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'opt', { value: function () {
  return this.clone((value: IValue) => value._optional = true);
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'addCleaner', { value: function (cleaner: (a: any) => any) {
  return this.clone((value: IValue) => value._cleaners.push(cleaner));
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'addCheck', { value: function (check: any) {
  return this.clone((value: IValue) => {
    if (typeof check === 'function')
      value._checks.push({ test: check });
    else if (check && typeof check.test === 'function')
      value._checks.push(check);
    else
      value._checks.push({ test: (value: any) => value === check });
  });
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'from', { value: function (value: any) {
  if (this._value && this._value instanceof Value) {
    return this._value.from(value)
  } else {
    return null;
  }
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'default', { value: function (value?: () => any) {
  return this._optional ? null : (value || null) && value();
}, enumerable: true, writable: true });

Object.defineProperty(Value, 'validate', { value:  function (value: any) {
  for (let i = 0; i < this._cleaners.length; i += 1)
    value = this._cleaners[i].call(this, value);
  for (let i = 0; i < this._checks.length; i += 1) {
    if (!this._checks[i].test(value))
      throw new Error('value "' + value + '"do not satisfy checks');
  }
  return value;
}, enumerable: true, writable: true });

// Boolean
export interface IBoolean extends IValue {
  _true: Set<string>;
  _false: Set<string>;
}

export const _Boolean = <IBoolean>Value.extends(function Boolean() {})
  .addCheck((v: any) => v === !!v);
_Boolean._true  = new Set(['y', 'yes', 'true']);
_Boolean._false = new Set(['n', 'no', 'false']);

Object.defineProperty(_Boolean, 'from', { value: function (value: any) {
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
}, enumerable: true });

// Number
export interface INumber extends IValue {}

export const _Number = <INumber>Value.extends(function Number() {});

Object.defineProperty(_Number, 'from', { value: function (value: any) {
  if (value == null) return this.default(() => 0);
  return this.validate(parseFloat(value));
}, enumerable: true });

// String
export interface IString extends IValue {}

export const _String = <IString>Value.extends(function String() {});

Object.defineProperty(_String, 'from', { value: function (value: any) {
    if (value == null) return this.default();
    return this.validate(String(value));
}, enumerable: true });

Object.defineProperty(_String, 'default', { value: function () {
  return '';
}, enumerable: true });


// Email
export interface IEmail extends IString {}

export const _Email = <IEmail>_String.extends(function Email() {})
  .addCheck(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/);

// Date
export interface IDate extends IString {}

export const _Date = <IDate>_String.extends(function Date() {});

Object.defineProperty(_Date, 'from', { value: function (value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(0, 10));
  else if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
}, enumerable: true, writable: true });

Object.defineProperty(_Date, 'default', { value: function () {
  return '0000-00-00';
}, enumerable: true, writable: true });

// Time
export interface ITime extends IString {}

export const _Time = <ITime>_String.extends(function Time() {});

Object.defineProperty(_Time, 'from', { value: function (value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(11, 12));
  if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
}, enumerable: true, writable: true });
Object.defineProperty(_Date, 'default', { value: function () {
  return '00:00:00';
}, enumerable: true, writable: true });

//----------------------------------------------------------

// ID
export interface IID extends IValue {}

export const ID = <IID>Value.extends(function ID() {});

Object.defineProperty(ID, 'from', { value: function (value: any) {
  if (typeof value === 'number' && value > 0) return this.validate(value);
  if (typeof value === 'string' && value.length > 0) return this.validate(value);
  if (value && value.ID) return this.from(value.ID);
  return this.default(() => uuid());
}, enumerable: true, writable: true });

// Enum
export interface IEnum extends IValue {
  _either: Set<IValue>;
}

export const Enum = <IEnum>Value.extends(function Enum() {});
Enum._either = new Set();

Object.defineProperty(Enum, 'of', { value: function (...args: any[]) {
  return this.clone((value: IEnum) => value._either = new Set(args));
}, enumerable: true, writable: true });

Object.defineProperty(Enum, 'from', { value: function (value: any) {
  if (this._either.has(value)) return this.validate(value);
  return this.default(() => this._either.values().next().value);
}, enumerable: true, writable: true });

// Record
export interface IRecord extends IValue {
  _object: Map<string, IValue>;
  add(field: string, type: any): this;
}

export const Record = <IRecord>Value.extends(function Record() {});
Record._object = new Map();

Object.defineProperty(Record, 'of', { value: function (model: { [name: string]: any }) {
  const record = this.clone();
  for (const field in model) {
    if (model[field] instanceof Array)
      record._object.set(field, Value.of(...model[field]));
    else
      record._object.set(field, Value.of(model[field]));
  }
  return record;
}, enumerable: true, writable: true });

Object.defineProperty(Record, 'add', { value: function (field: string, type: any) {
  const record = this.clone();
  record._object.set(field, Value.of(type));
  return record;
}, enumerable: true, writable: true });

Object.defineProperty(Record, 'from', { value: function (data: any) {
  if (data && data instanceof Object) {
    const record = <any>{};
    for (const [name, type] of this._object)
      record[name] = type.from(data[name]);
    return this.validate(record);
  } else {
    return this.default();
  }
}, enumerable: true, writable: true });

Object.defineProperty(Record, 'default', { value: function () {
  return this.from({});
}, enumerable: true, writable: true });

// Entity
export interface IEntity extends IRecord {
  ID: IID;
  __get_ID(): IID;
  ByID: IMap;
  __get_ByID(): IMap;
}

export const Entity = <IEntity>Record.extends(function Entity() {})
  .add('ID', ID);

Object.defineProperty(Entity, 'ID', { get: function () {
  return this.__get_ID();
}, enumerable: true });
Object.defineProperty(Entity, '__get_ID', { value: function () {
  return ID;
}, enumerable: true, writable: true });

Object.defineProperty(Entity, 'ByID', { get: function () {
  return this.__get_ByID();
}, enumerable: true });
Object.defineProperty(Entity, '__get_ByID', { value: function () {
  return _Map.of(this.ID, this);
}, enumerable: true, writable: true });

// Aggregate
export interface IAggregate extends IEntity {}

export const Aggregate = <IAggregate>Entity.extends(function Aggregate() {});

Object.defineProperty(Aggregate, '__get_Set', { value: function () {
  throw new Error('Forbidden');
}, enumerable: true, writable: true });

Object.defineProperty(Aggregate, '__get_Array', { value: function () {
  throw new Error('Forbidden');
}, enumerable: true, writable: true });

Object.defineProperty(Aggregate, 'Map', { value: function (index: any) {
  throw new Error('Forbidden');
}, enumerable: true, writable: true });

Object.defineProperty(Aggregate, '__get_ByID', { value: function () {
  throw new Error('Forbidden');
}, enumerable: true, writable: true });

// ------------------------------------------

// Set
export interface ISet extends IValue {
  _subtype: IValue;
}

export const _Set = <ISet>Value.extends(function Set() {});
_Set._subtype = <IValue>null;

Object.defineProperty(_Set, 'of', { value: function (type: any) {
  return this.clone((value: ISet) => value._subtype = Value.of(type));
}, enumerable: true, writable: true });

Object.defineProperty(_Set, 'from', { value: function (data: any) {
  if (data != null) {
    const set = new Set(data);
    set.toJSON = this.toJSON;
    return this.validate(set);
  } else {
    return this.default();
  }
}, enumerable: true, writable: true });

Object.defineProperty(_Set, 'default', { value: function () {
  const set = new Set();
  set.toJSON = this.toJSON;
  return set;
}, enumerable: true, writable: true });

Object.defineProperty(_Set, 'toJSON', { value: function () {
  return Array.from(this);
}, enumerable: true, writable: true });

// Array
export interface IArray extends IValue {
  _subtype: IValue;
}

export const _Array = <IArray>Value.extends(function Array() {});
_Array._subtype = null;

Object.defineProperty(_Array, 'of', { value: function (type: any) {
  return this.clone((value: IArray) => value._subtype = Value.of(type));
}, enumerable: true, writable: true });

Object.defineProperty(_Array, 'from', { value: function (data: any) {
    if (data instanceof Array) {
      const array = new Array(data.length);
      for (let i = 0; i < data.length; i += 1)
        array[i] = this._subtype.from(data[i]);
      return this.validate(array);
    } else {
      return this.default();
    }
}, enumerable: true, writable: true });

Object.defineProperty(_Array, 'default', { value: function () {
  return new Array();
}, enumerable: true, writable: true });

// Map
export interface IMap extends IValue {
  _index: IValue;
  _subtype: IValue;
}

export const _Map = <IMap>Value.extends(function Map() {});
_Map._index   = null;
_Map._subtype = null;

Object.defineProperty(_Map, 'of', { value: function (index: any, type: any) {
  return this.clone((value: IMap) => {
    value._index = Value.of(index);
    value._subtype = Value.of(type);
  });
}, enumerable: true, writable: true });

Object.defineProperty(_Map, 'from', { value: function (data: any) {
  const map = new Map();
  map.toJSON = this.toJSON;
  if (data == null) return this.default();
  for (const [key, value] of data)
    map.set(this._index.from(key), this._subtype.from(value));
  return this.validate(map);
}, enumerable: true, writable: true });

Object.defineProperty(_Map, 'default', { value: function () {
  const map = new Map();
  map.toJSON = this.toJSON;
  return map;
}, enumerable: true, writable: true });

Object.defineProperty(_Map, 'toJSON', { value: function () {
  return Array.from(this);
}, enumerable: true, writable: true });
