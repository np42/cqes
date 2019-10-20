import { v4 as uuid }    from 'uuid';
import { isConstructor } from './util';
import { inspect }       from 'util';

const _tag      = Symbol('cqes-type');
const _Boolean  = global.Boolean;
const _Number   = global.Number;
const _String   = global.String;
const _Function = global.Function;
const _Object   = global.Object;
const _Date     = global.Date;
const _Set      = global.Set;
const _Array    = global.Array;
const _Map      = global.Map;

export type Typer     = { from(data: any): Typed };
export type Typed     = any;

export class TypeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type predicate   = (a: any) => boolean;
export type constraint  = RegExp | predicate;
export type transformer = (a: any) => any;
export type getter      = () => any;

const makeConstructor = (name: string) => {
  if (!/^[a-z$_][a-z0-9$_]*$/i.test(name)) throw new Error('Bad name');
  return eval
  ( [ '(function ' + name + '() {'
    , '  if (this instanceof ' + name + ') return this;'
    , '  return ' + name + '.of.apply(' + name + ', arguments);'
    , '})'
    ].join('\n')
  );
}

const tagCQESType = (Type: any) => {
  _Object.defineProperty(Type, _tag, { value: true, enumerable: false, writable: false });
}

export function isType(Type: any) {
  return !!(Type && Type[_tag]);
}

// Value
export interface IValue<A> {
  (...types: Array<any>): this;

  _default:     () => A;
  _constraints: Array<any>;
  _modifiers:   Array<any>;

  defineProperty(name: string, value: any, isGetter?: boolean): void;

  extends<T>(this: T, name: string):         T;
  of<T>(this: T, ...a: any[]):               T;
  addConstraint<T>(this: T, fn: constraint): T;
  transform<T>(this: T, fn: transformer):    T;
  setDefault<T>(this: T, fn: getter):        T;

  default<X>(this: new (input?: any) => X):         X;
  from<X>(this: new (input?: any) => X, data: any): X;
  validate<X>(data: X):                             X;
}

export const Value = <IValue<any>>function Value() {};

tagCQESType(Value);

Value.defineProperty = function defineProperty(name: string, value: any, isGetter?: boolean) {
  if (isGetter) {
    if (typeof value === 'function' && value.length === 0) {
      const indirection = '__get_' + name;
      _Object.defineProperty(this, indirection, { value, enumerable: true, writable: true });
      if (!(name in this)) {
        _Object.defineProperty(this, name, { get: function () {
          return this[indirection]();
        }, enumerable: true });
      }
    } else {
      throw new Error('Getters must be function without argument');
    }
  } else {
    _Object.defineProperty(this, name, { value, enumerable: true, writable: true });
  }
}

Value.defineProperty('_constraints', new _Array());
Value.defineProperty('_modifiers', new _Array());

Value.defineProperty('extends', function extend(name: string) {
  const value = makeConstructor(name);
  tagCQESType(value);
  let parent = this;
  while (parent != null) {
    if (parent.hasOwnProperty(_tag)) break ;
    parent = _Object.getPrototypeOf(parent);
  }
  if (parent == null) throw new Error('Must be a CQES/Type');
  for (let key in parent) {
    const property = _Object.getOwnPropertyDescriptor(parent, key);
    if (property == null) continue ;
    if ('value' in property) {
      switch (_Object.prototype.toString.call(property.value)) {
      case '[object Array]': { value[key] = _Array.from(parent[key]); } break ;
      case '[object Set]':   { value[key] = new _Set(parent[key]); } break ;
      case '[object Map]':   { value[key] = new _Map(parent[key]); } break ;
      default: { _Object.defineProperty(value, key, property); } break ;
      }
    } else {
      _Object.defineProperty(value, key, property);
    }
  }
  return value;
});

Value.defineProperty('clone', function clone(modifier?: (a: any) => any) {
  const value = this.extends(this.name);
  if (modifier) modifier(value);
  return value;
});

Value.defineProperty('of', function of(model?: any, ...rest: any[]) {
  if (model && model[_tag]) return model;
  throw new Error('Value can not old value');
});

Value.defineProperty('transform', function transform(cleaner: (a: any) => any) {
  return this.clone((value: IValue<any>) => value._modifiers.push(cleaner));
});

Value.defineProperty('addConstraint', function addConstraint(constraint: any) {
  return this.clone((value: IValue<any>) => {
    if (typeof constraint === 'function')
      value._constraints.push({ test: constraint });
    else if (constraint && typeof constraint.test === 'function')
      value._constraints.push(constraint);
    else
      value._constraints.push({ test: (value: any) => value === constraint });
  });
});

Value.defineProperty('from', function from(value: any) {
  return this.validate(value);
});

Value.defineProperty('validate', function validate(value: any) {
  for (let i = 0; i < this._modifiers.length; i += 1)
    value = this._modifiers[i].call(this, value);
  for (let i = 0; i < this._constraints.length; i += 1) {
    const constraint = this._constraints[i];
    if (!constraint.test(value)) {
      const constraintName = constraint instanceof RegExp ? constraint.toString()
        : constraint.test.name == '' || constraint.test.name == 'test' ? constraint.test.toString()
        : constraint.test.name;
      throw new TypeError('Value "' + inspect(value) + '" do not satisfy constraint ' + constraintName);
    }
  }
  return value;
});

Value.defineProperty('setDefault', function setDefault(defaultValue: () => any) {
  if (typeof defaultValue != 'function') throw new Error('Default value must be a function');
  return this.clone((value: IValue<any>) => value._default = defaultValue);
});

Value.defineProperty('default', function def() {
  if (this._default != null) return this._default();
  throw new TypeError('Mandatory value was not provied');
});

// Boolean
export interface IBoolean extends IValue<boolean> {
  _true:  Set<string>;
  _false: Set<string>;
}

export const Boolean = <IBoolean>Value.extends('Boolean')
  .addConstraint((v: any) => v === !!v);
Boolean.defineProperty('_true', new _Set(['y', 'yes', 'true']));
Boolean.defineProperty('_false', new _Set(['n', 'no', 'false']));

Boolean.defineProperty('from', function from(value: any) {
  if (value == null) value = this.default();
  switch (typeof value) {
  case 'string': {
    if (this._true.has(value.toLowerCase())) return this.validate(true);
    if (this._false.has(value.toLowerCase())) return this.validate(false);
    return this.validate(value);
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
export interface INumber extends IValue<number> {
  between<T>(this: T, min: number, max: number): T;
}

export const Number = <INumber>Value.extends('Number');

Number.defineProperty('between', function between(min: number, max: number) {
  return this.addConstraint(function (value: number) {
    return value >= min && value <= max;
  });
});

Number.defineProperty('from', function from(value: any) {
  if (value == null) return this.default();
  return this.validate(parseFloat(value));
});

// String
export interface IString extends IValue<string> {}

export const String = <IString>Value.extends('String');

String.defineProperty('from', function from(value: any) {
  if (value == null) value = this.default();
  switch (typeof value) {
  case 'number': case 'boolean': { value = _String(value); } break ;
  }
  return this.validate(value);
});

// Enum
export interface IEnum extends IValue<Object> {
  _either: Set<IValue<any>>;
}

export const Enum = <IEnum>Value.extends('Enum');

Enum.defineProperty('_either', new _Set());

Enum.defineProperty('of', function of(...args: any[]) {
  return this.clone((value: IEnum) => value._either = new _Set(args));
});

Enum.defineProperty('from', function from(value: any) {
  if (this._either.has(value)) return this.validate(value);
  return this.default();
});

// Record
export interface IRecord extends IValue<Object> {
  new (input: any): this;
  _fields: Map<string, IValue<any>>;

  add<T>(this: T, field: string, type: any, defaultValue?: any):        T;
  opt<T>(this: T, field: string, type: any):                            T;
  rewrite<T>(this: T, field: string, predicate: predicate, value: any): T;
  either<T>(this: T, ...args: Array<Array<string> | string>):           T;
}

export const Record = <IRecord>Value.extends('Record');
Record.defineProperty('_fields', new _Map());

Record.defineProperty('of', function of(model: { [name: string]: any }) {
  const record = this.clone();
  for (const field in model) {
    if (model[field] instanceof _Array)
      record._fields.set(field, Value.of(...model[field]));
    else
      record._fields.set(field, Value.of(model[field]));
  }
  return record;
});

Record.defineProperty('either', function either(...args: Array<Array<string> | string>) {
  return this.addConstraint((data: Object) => {
    either: for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === 'string') {
        if (data[arg] != null)
          return true;
      } else if (arg instanceof _Array) {
        for (let ii = 0; ii < arg.length; ii += 1)
          if (data[arg[ii]] == null)
            continue either;
        return true;
      } else {
        // Skip silently
      }
    }
    return false;
  });
});

Record.defineProperty('add', function add(field: string, type: any, defaultValue?: any) {
  const record = this.clone();
  type = Value.of(type);
  if (arguments.length > 2) {
    if (isType(defaultValue)) {
      type = type.setDefault(() => defaultValue.default());
    } else if (isConstructor(defaultValue)) {
      type = type.setDefault(() => new defaultValue())
    } else if (typeof defaultValue === 'function') {
      type = type.setDefault(defaultValue);
    } else {
      type = type.setDefault(() => defaultValue);
    }
  }
  record._fields.set(field, type);
  return record;
});

Record.defineProperty('opt', function opt(field: string, type: any) {
  return this.add(field, type, null);
});

Record.defineProperty('rewrite', function rewrite(field: string, predicate: predicate, value: any) {
  return this.transform((record: any) => {
    if (record && predicate(record[field]))
      record[field] = value;
    return record;
  });
});

Record.defineProperty('from', function from(data: any) {
  if (data && data instanceof _Object) {
    const record = <any>new this();
    for (const [name, type] of this._fields) {
      try {
        record[name] = type.from(data[name]);
      } catch (e) {
        const strval = JSON.stringify(data[name]);
        throw new TypeError('Failed on field: ' + name + ' = ' + strval + '\n' + _String(e));
      }
    }
    return this.validate(record);
  } else {
    const record = this.default();
    return this.validate(record);
  }
});

// Collection
export interface ICollection<A> extends IValue<A> {
  new (input: any): A;
  _subtype: IValue<any>;
  notEmpty: this;
}

export const Collection = <ICollection<any>>Value.extends('Collection');
Collection.defineProperty('_subtype', null);

Collection.defineProperty('notEmpty', function notEmpty() {
  return this.addConstraint(function notEmpty(value: any) {
    return _Array.from(value).length > 0;
  });
}, true);

// Set
export interface ISet extends ICollection<Set<any>> {}

export const Set = <ISet>Collection.extends('Set');

Set.defineProperty('_default', function () {
  const set = new _Set();
  _Object.defineProperty(set, 'toJSON', { value: this.toJSON });
  return set;
});

Set.defineProperty('of', function (type: any) {
  return this.clone((value: ISet) => value._subtype = Value.of(type));
});

Set.defineProperty('from', function (data: any) {
  if (data instanceof _Array || data instanceof _Set) {
    const set = new _Set();
    _Object.defineProperty(set, 'toJSON', { value: this.toJSON });
    for (const item of data) {
      try {
        set.add(this._subtype.from(item));
      } catch (e) {
        const strval = JSON.stringify(item);
        throw new TypeError('Failed on item: ' + strval + '\n' + _String(e));
      }
    }
    return this.validate(set);
  } else {
    const set = this.default();
    return this.validate(set);
  }
});

Set.defineProperty('toJSON', function toJSON() {
  return _Array.from(this);
});

Set.defineProperty('notEmpty', function notEmpty() {
  return this.addConstraint(function notEmpty(value: any) {
    return value.size > 0;
  });
}, true);

// Array
export interface IArray extends ICollection<Array<any>> {}

export const Array = <IArray>Collection.extends('Array');

Array.defineProperty('_default', function () {
  return new _Array();
});

Array.defineProperty('of', function (type: any) {
  return this.clone((value: IArray) => value._subtype = Value.of(type));
});

Array.defineProperty('from', function (data: any) {
    if (data instanceof _Array) {
      const array = new _Array(data.length);
      for (let i = 0; i < data.length; i += 1) {
        try {
          array[i] = this._subtype.from(data[i]);
        } catch (e) {
          const strval = JSON.stringify(data[i]);
          throw new TypeError('Failed on index: ' + i + ' = ' + strval + '\n' + _String(e));
        }
      }
      return this.validate(array);
    } else {
      const array = this.default();
      return this.validate(array);
    }
});

Array.defineProperty('notEmpty', function notEmpty() {
  return this.addConstraint(function notEmpty(value: any) {
    return value.length > 0;
  });
}, true);

// Map
export interface IMap extends ICollection<Map<any, any>> {
  _index: IValue<any>;
}

export const Map = <IMap>Collection.extends('Map');

Map.defineProperty('_index', null);

Map.defineProperty('_default', function () {
  const map = new _Map();
  _Object.defineProperty(map, 'toJSON', { value: this.toJSON });
  return map;
});

Map.defineProperty('of', function (index: any, type: any) {
  return this.clone((value: IMap) => {
    value._index = Value.of(index);
    value._subtype = Value.of(type);
  });
});

Map.defineProperty('from', function (data: any) {
  if (data instanceof _Array || data instanceof _Map) {
    const map = new _Map();
    _Object.defineProperty(map, 'toJSON', { value: this.toJSON });
    for (const [key, value] of data) {
      try {
        map.set(this._index.from(key), this._subtype.from(value));
      } catch (e) {
        const strkey = JSON.stringify(key);
        const strval = JSON.stringify(value);
        throw new TypeError('Failed on key: ' + strkey + ' = ' + strval + '\n' + _String(e));
      }
    }
    return this.validate(map);
  } else {
    const map = this.default();
    return this.validate(map);
  }
});

Map.defineProperty('toJSON', function toJSON() {
  return _Array.from(this);
});

Map.defineProperty('notEmpty', function notEmpty() {
  return this.addConstraint((value: any) => {
    return value.size > 0;
  });
}, true);

// ------------------------------------------
// Extended Types
// ------------------------------------------

// Email
export interface IEmail extends IString {}

export const _Email = <IEmail>String.extends('Email')
  .addConstraint(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/);

// Date
export interface IDate extends IString {
  defNow(): this;
}

export const Date = <IDate>String.extends('Date');

Date.defineProperty('from', function from(value: any) {
  if (value instanceof _Date)
    return this.validate(value.toISOString().substr(0, 10));
  else if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return this.validate(_String(value));
  else
    return this.default();
});

Date.defineProperty('defNow', function defNow() {
  return this.setDefault(() => new _Date().toISOString().substr(0, 10));
});

// Time
export interface ITime extends IString {
  defNow(): this;
}

export const Time = <ITime>String.extends('Time');

Time.defineProperty('from', function from(value: any) {
  if (value instanceof _Date)
    return this.validate(value.toISOString().substr(11, 12));
  if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?(Z|[+\-]\d+)?$/.test(value))
    return this.validate(_String(value));
  else
    return this.default();
});

Time.defineProperty('defNow', function defNow() {
  return this.setDefault(() => new _Date().toISOString().substr(11, 12));
});

// DateTime
export interface IDateTime extends IString {
  defNow(): this;
}

export const DateTime = <IDateTime>String.extends('DateTime')
  .transform(function (value: string) {
    const date = /^\d{4}(-\d\d){2}( |T)(\d\d)(:\d\d){2}(\.\d{3})?(Z|[+\-]\d+)?$/.exec(value);
    if (!date) return this.default();
    if (date[6] && date[6] != 'Z') {
      const idate = new _Date(value).toISOString();
      return idate.substr(0, 10) + ' ' + idate.substr(11, 12);
    } else {
      return value.substr(0, 10) + ' ' + value.substr(11, 12);
    }
  });

DateTime.defineProperty('from', function from(value: any) {
  if (value instanceof _Date)
    return this.validate(value.toISOString());
  else if (/^\d{4}(-\d\d){2}( |T)\d\d(:\d\d){2}(\.\d{3})?(Z|[+\-]\d+)?$/.test(value))
    return this.validate(_String(value));
  else
    return this.default();
});

DateTime.defineProperty('defNow', function defNow() {
  return this.setDefault(() => new _Date().toISOString().substr(0, 23).replace('T', ' '));
});

// UUID
export interface IUUID extends IString {}

export const UUID = <IUUID>String.extends('UUID')
  .addConstraint(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i);

//---------------------------

/*
// Price
// cf: https://www.easymarkets.com/eu/learn-centre/discover-trading/currency-acronyms-and-abbreviations/
export interface IPrice extends IRecord {}

export const _Price = <IPrice>Record.extends(function Price() {})
  .add('amount', _Number)
  .add('currency', Enum.of( 'EUR', 'JPY', 'CHF', 'USD', 'AFN', 'ALL', 'DZD', 'AOA', 'ARS', 'AMD', 'AWG'
                          , 'AUD', 'AZN', 'BSD', 'BHD', 'BDT', 'BBD', 'BYR', 'BZD', 'BMD', 'BTN', 'BOB'
                          , 'BAM', 'BWP', 'BRL', 'GBP', 'BND', 'BGN', 'BIF', 'XOF', 'XAF', 'XPF', 'KHR'
                          , 'CAD', 'CVE', 'KYD', 'CLP', 'CNY', 'COP', 'KMF', 'CDF', 'CRC', 'HRK', 'CUC'
                          , 'CUP', 'CZK', 'DKK', 'DJF', 'DOP', 'XCD', 'EGP', 'SVC', 'ETB', 'FKP', 'FJD'
                          , 'GMD', 'GEL', 'GHS', 'GIP', 'GTQ', 'GNF', 'GYD', 'HTG', 'HNL', 'HKD', 'HUF'
                          , 'ISK', 'INR', 'IDR', 'IRR', 'IQD', 'ILS', 'JMD', 'JPY', 'JOD', 'KZT', 'KES'
                          , 'KWD', 'KGS', 'LAK', 'LBP', 'LSL', 'LRD', 'LYD', 'MOP', 'MKD', 'MGA', 'MWK'
                          , 'MYR', 'MVR', 'MRO', 'MUR', 'MXN', 'MDL', 'MNT', 'MAD', 'MZN', 'MMK', 'ANG'
                          , 'NAD', 'NPR', 'NZD', 'NIO', 'NGN', 'KPW', 'NOK', 'OMR', 'PKR', 'PAB', 'PGK'
                          , 'PYG', 'PEN', 'PHP', 'PLN', 'QAR', 'RON', 'RUB', 'RWF', 'WST', 'STD', 'SAR'
                          , 'RSD', 'SCR', 'SLL', 'SGD', 'SBD', 'SOS', 'ZAR', 'KRW', 'RO)', 'LKR', 'SHP'
                          , 'SDG', 'SRD', 'SZL', 'SEK', 'CHF', 'SYP', 'TWD', 'TZS', 'THB', 'TOP', 'TTD'
                          , 'TND', 'TRY', 'TMM', 'USD', 'UGX', 'UAH', 'UYU', 'AED', 'VUV', 'VEB', 'VND'
                          , 'YER', 'ZMK', 'ZWD' ));

// GPSPoint
export interface IGPSPoint extends IRecord {}

export const _GPSPoint = <IGPSPoint>Record.extends(function GPSPoint() {})
  .add('longitude', _Number)
  .add('latitude', _Number);


// Distance
export interface IDistance extends IRecord {}

export const _Distance = <IDistance>Record.extends(function Distance() {})
  .add('value', _Number)
  .add('unit', Enum.of('m', 'km'));
*/

