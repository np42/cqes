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

export type rewriter    = (a: any) => any;
export type predicate   = (a: any) => boolean;
export type assertion   = (a: any) => void;
export type constraint  = RegExp | predicate | assertion;
export type parser      = (a: any) => any | void;

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
  (...types: Array<any>):    this;
  new (input: any):          A;

  _default:     () => A;
  _rewriters:   Array<any>;
  _parsers:     Array<any>;
  _assertions:  Array<any>;

  defineProperty(name: string, value: any, isGetter?: boolean): void;

  extends<T>(this: T, name: string):                                     T;
  of<T>(this: T, ...a: any[]):                                           T;
  setProperty<T>(this: T, name: string, value: any, isGetter?: boolean): T;
  addConstraint<T>(this: T, fn: constraint):                             T;
  addParser<T>(this: T, fn: parser):                                     T;
  setDefault<T>(this: T, fn: any):                                       T;
  mayNull:                                                               this;

  from<X>(this: new (input?: any) => X, data: any): X;
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
};

Value.defineProperty('_rewriters',  new _Array());
Value.defineProperty('_parsers',    new _Array());
Value.defineProperty('_assertions', new _Array());

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
  if (isConstructor(model)) throw new Error(model.name + ' is not a valid type, forgot an import ?');
  throw new Error('Value can not hold value');
});

Value.defineProperty('setProperty', function setProperty(name: string, value: any, isGetter?: boolean) {
  return this.clone((type: IValue<any>) => {
    type.defineProperty(name, value, isGetter);
  });
});

Value.defineProperty('setDefault', function setDefault(defaultValue: any) {
  return this.clone((type: IValue<any>) => {
    if (isType(defaultValue)) {
      type._default = () => defaultValue.default();
    } else if (isConstructor(defaultValue)) {
      type._default = () => new defaultValue();
    } else if (typeof defaultValue === 'function') {
      type._default = defaultValue;
    } else {
      type._default = () => defaultValue;
    }
  });
});

Value.defineProperty('mayNull', function mayNull() {
  return this.setDefault(null);
}, true);

Value.defineProperty('addRewriter', function rewrite(rewriter: rewriter) {
  return this.clone((type: IValue<any>) => {
    this._rewriters.push(rewriter);
  });
});

Value.defineProperty('addParser', function addParser(cleaner: (a: any) => any) {
  return this.clone((value: IValue<any>) => value._parsers.push(cleaner));
});

Value.defineProperty('addConstraint', function addConstraint(constraint: any) {
  return this.clone((value: IValue<any>) => {
    if (typeof constraint === 'function')
      value._assertions.push(constraint);
    else if (constraint instanceof RegExp)
      value._assertions.push((value: any) => {
        constraint.lastIndex = 0;
        const result = constraint.test(value);
        if (result === false)
          throw new TypeError('Constraint ' + constraint + ' not satisfied');
      });
    else
      value._assertions.push((value: any) => {
        const result = constraint === value;
        if (result === false)
          throw new TypeError('Constraint (=== ' + constraint + ') not satisfied')
      });
  });
});

Value.defineProperty('from', function from(value: any) {
  for (let i = 0; i < this._rewriters.length; i += 1) {
    value = this._rewriters[i].call(this, value);
  }
  if (value == null) {
    if (this._default != null) value = this._default();
    else throw new TypeError('Mandatory value is missing');
    if (value === null) return null;
  }
  for (let i = 0; i < this._parsers.length; i += 1) {
    const result = this._parsers[i].call(this, value);
    if (result == null) continue ;
    value = result;
    break ;
  }
  for (let i = 0; i < this._assertions.length; i += 1)
    this._assertions[i].call(this, value);
  return value;
});

// Boolean
export interface IBoolean extends IValue<boolean> {
  _true:  Set<string>;
  _false: Set<string>;
}

export const Boolean = <IBoolean>Value.extends('Boolean')
  .setProperty('_true', new _Set(['y', 'yes', 'true']))
  .setProperty('_false', new _Set(['n', 'no', 'false']))
  .addParser((value: string) => {
    if (typeof value !== 'string') return ;
    if (this._true.has(value.toLowerCase())) return this.validate(true);
    if (this._false.has(value.toLowerCase())) return this.validate(false);
  })
  .addParser((value: number) => {
    if (typeof value !== 'number') return ;
    return !(isNaN(value) || value === 0);
  })
  .addConstraint((v: any) => {
    if (v !== !!v) throw new TypeError('Require a Boolean');
  });

// Number
export interface INumber extends IValue<number> {
  between<T>(this: T, min: number, max: number): T;
}

export const Number = <INumber>Value.extends('Number')
  .setProperty('between', function between(min: number, max: number) {
    return this.addConstraint(function isBetween(value: number) {
      return value >= min && value <= max;
    });
  })
  .addParser(function parseNumber(value: string) {
    if (typeof value !== 'string') return ;
    return parseFloat(value);
  })
  .addConstraint(function isNumber(value: number) {
    if (typeof value !== 'number') throw new TypeError('Require a Number');
    if (isNaN(value)) throw new TypeError('Number is NaN');
  });

// String
export interface IString extends IValue<string> {}

export const String = <IString>Value.extends('String')
  .addParser(function parseNative(value: any) {
    switch (typeof value) {
    case 'number': case 'boolean': return _String(value);
    }
  })
  .addConstraint(function isString(value: any) {
    if (typeof value !== 'string') throw new TypeError('Require a String');
  });

// Enum
export interface IEnum extends IValue<Object> {
  _either: Set<IValue<any>>;
}

export const Enum = <IEnum>Value.extends('Enum')
  .setProperty('_either', new _Set())
  .setProperty('of', (...args: any[]) => {
    return this.clone((value: IEnum) => value._either = new _Set(args));
  })
  .addConstraint(function isIn(value: any) {
    if (this._either.has(value)) return ;
    const values = Array.from(this._eithers).join(', ');
    throw new Error('Value ' + value + ' must be one of ' + values);
  });

// Record
export interface IRecord extends IValue<Object> {
  _fields: Map<string, IValue<any>>;

  add<T>(this: T, field: string, type: any):                            T;
  rewrite<T>(this: T, field: string, predicate: predicate, value: any): T;
}

export const Record = <IRecord>Value.extends('Record')
  .setProperty('_fields', new _Map())
  .setProperty('of', function of(model: { [name: string]: any }) {
    const record = this.clone();
    for (const field in model) {
      if (model[field] instanceof _Array)
        record._fields.set(field, Value.of(...model[field]));
      else
        record._fields.set(field, Value.of(model[field]));
    }
    return record;
  })
  .setProperty('either', function either(...args: Array<Array<string> | string>) {
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
  })
  .setProperty('add', function add(field: string, type: any) {
    const record = this.clone();
    type = Value.of(type);
    record._fields.set(field, type);
    return record;
  })
  .setProperty('rewrite', function rewrite(field: string, predicate: predicate, value: any) {
    return this.addRewriter((record: any) => {
      if (record && predicate(record[field]))
        record[field] = value;
      return record;
    });
  })
  .addParser(function parseRecord(data: any) {
    if (data == null) data = this.default();
    const result = new this();
    for (const [name, type] of this._fields) {
      try { result[name] = type.from(data[name]); }
      catch (e) {
        const strval = JSON.stringify(data[name]);
        throw new TypeError('Failed on field: ' + name + ' = ' + strval + '\n' + _String(e));
      }
    }
    return result;
  })
  .addConstraint(function isRecord(data: any) {
    if (typeof data != 'object') throw new TypeError('Require an object');
  });

// Collection
export interface ICollection<A> extends IValue<A> {
  _subtype: IValue<any>;
  notEmpty: this;
}

export const Collection = <ICollection<any>>Value.extends('Collection')
  .setProperty('_subtype', null)
  .setProperty('notEmpty', function notEmpty() {
    throw new Error('Not implemented');
  }, true);

// Set
export interface ISet extends ICollection<Set<any>> {}

export const Set = <ISet>Collection.extends('Set')
  .setProperty('of', function (type: any) {
    return this.clone((value: ISet) => value._subtype = Value.of(type));
  })
  .setProperty('toJSON', function toJSON() {
    return _Array.from(this);
  })
  .setDefault(function () {
    const set = new _Set();
    _Object.defineProperty(set, 'toJSON', { value: this.toJSON });
    return set;
  })
  .setProperty('notEmpty', function notEmpty() {
    return this.addConstraint(function notEmpty(value: any) {
      return value.size > 0;
    });
  }, true)
  .addParser(function parseArray(data: any) {
    if (!(data instanceof _Array || data instanceof _Set)) return ;
    const set = new _Set();
    for (const value of data)
      set.add(this._subtype.from(value));
    _Object.defineProperty(set, 'toJSON', { value: this.toJSON });
    return set;
  })
  .addConstraint(function isSet(data: any) {
    if (!(data instanceof _Set)) throw new TypeError('Require a Set');
  });

// Array
export interface IArray extends ICollection<Array<any>> {}

export const Array = <IArray>Collection.extends('Array')
  .setProperty('_default', function () {
    return new _Array();
  })
  .setProperty('of', function (type: any) {
    return this.clone((value: IArray) => value._subtype = Value.of(type));
  })
  .setProperty('notEmpty', function notEmpty() {
    return this.addConstraint(function notEmpty(value: any) {
      return value.length > 0;
    });
  }, true)
  .addParser(function parseArray(data: any) {
    if (!(data instanceof _Array)) return ;
    const array = new _Array();
    for (let i = 0; i < data.length; i += 1) {
      try { array[i] = this._subtype.from(data[i]); }
      catch (e) {
        const strval = JSON.stringify(data[i]);
        throw new TypeError('Failed on index: ' + i + ' = ' + strval + '\n' + _String(e));
      }
    }
  })
  .addConstraint(function isArray(data: any) {
    if (!(data instanceof _Array)) throw new TypeError('Require an Array');
  });

// Map
export interface IMap extends ICollection<Map<any, any>> {
  _index: IValue<any>;
}

export const Map = <IMap>Collection.extends('Map')
  .setProperty('_index', null)
  .setProperty('_default', function () {
    const map = new _Map();
    _Object.defineProperty(map, 'toJSON', { value: this.toJSON });
    return map;
  })
  .setProperty('toJSON', function toJSON() {
    return _Array.from(this);
  })
  .setProperty('notEmpty', function notEmpty() {
    return this.addConstraint((value: any) => {
      return value.size > 0;
    });
  }, true)
  .setProperty('of', function (index: any, type: any) {
    return this.clone((value: IMap) => {
      value._index = Value.of(index);
      value._subtype = Value.of(type);
    });
  })
  .addParser(function parseArray(data: any) {
    if (!(data instanceof _Array || data instanceof _Map)) return ;
    const map = new _Map();
    for (const [key, value] of data) {
      try { map.set(this._index.from(key), this._subtype.from(value)); }
      catch (e) {
        const strkey = JSON.stringify(key);
        const strval = JSON.stringify(value);
        throw new TypeError('Failed on ' + strkey + ' = ' + strval + '\n' + _String(e));
      }
    }
    _Object.defineProperty(map, 'toJSON', { value: this.toJSON });
    return map;
  })
  .addConstraint(function isMap(data: any) {
    if (!(data instanceof _Map)) throw new TypeError('Require a Map');
  });

// ------------------------------------------
// Extended Types
// ------------------------------------------

// UUID
export interface IUUID extends IString {
  _blank:   string;
  mayBlank: this;
}

export const UUID = <IUUID>String.extends('UUID')
  .setProperty('_blank', '00000000-0000-0000-0000-000000000000')
  .setProperty('mayBlank', function () {
    return this.setDefault(this._blank);
  }, true)
  .addConstraint(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i);

// Email
export interface IEmail extends IString {}

export const _Email = <IEmail>String.extends('Email')
  .addConstraint(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/);

// Date
export interface IDate extends IString {
  mayToday: this;
}

export const Date = <IDate>String.extends('Date')
  .setProperty('mayToday', function mayToday() {
    return this.setDefault(() => new _Date());
  }, true)
  .addParser(function parseDate(value: any) {
    if (!(value instanceof _Date)) return ;
    return value.toISOString().substr(0, 10);
  })
  .addConstraint(function isDate(value: any) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return ;
    throw new TypeError('Invalide Date format');
  });

// Time
export interface ITime extends IString {
  mayNow: this;
}

export const Time = <ITime>String.extends('Time')
  .setProperty('mayNow', function mayNow() {
    return this.setDefault(() => new _Date());
  }, true)
  .addParser(function parseDate(value: any) {
    if (!(value instanceof _Date)) return ;
    return value.toISOString().substr(11, 12);
  })
  .addConstraint(function isTime(value: any) {
    if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?(Z|[+\-]\d+)?$/.test(value)) return ;
    throw new TypeError('Invalide Time format');
  });


// DateTime
export interface IDateTime extends IString {
  mayNow: this;
}

export const DateTime = <IDateTime>Value.extends('DateTime')
  .setProperty('mayNow', function mayNow() {
    return this.setDefault(() => new _Date());
  }, true)
  .addParser(function parseTimestamp(value: number) {
    if (typeof value !== 'number' || !(value > 0)) return ;
    return new _Date(value);
  })
  .addParser(function parseString(value: string) {
    if (typeof value !== 'string') return ;
    const date = /^\d{4}(-\d\d){2}( |T)(\d\d)(:\d\d){2}(\.\d{3})?(Z|[+\-]\d+)?$/.exec(value);
    return new _Date(value);
  })
  .addConstraint(function isDate(value: Date) {
    if (!(value instanceof _Date)) throw new TypeError('Require a JsDate');
    if (value.toString() === 'Invalid Date') throw new TypeError('Invalid date format');
  });


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

