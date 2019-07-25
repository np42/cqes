import { v4 as uuid } from 'uuid';

const model_f = Symbol('CQES_Model');

// Value
export interface IValue {
  new (input: any): any;
  (): void;

  _name:     string;
  _value:    any;
  _default:  () => any;
  _optional: boolean;
  _checks:   Array<any>;
  _cleaners: Array<any>;

  defineProperty(name: string, value: any, isGetter?: boolean): void;
  extends(type: Function):   this;
  of(...a: any[]):           this;
  addCheck(check: any):      this;
  addCleaner(cleaner: (a: any) => any): this;
  opt():                     this;
  init(a: any):              this;

  Set:             ISet;
  Array:           IArray;
  Map(index: any): IMap;

  default():       any;
  from(data: any): any;
}

export const Value = <IValue>function Value() {};
Value[model_f] = true;
Value.defineProperty = function defineProperty(name: string, value: any, isGetter?: boolean) {
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

Value.defineProperty('Set', function Set() { return _Set.of(this) }, true);
Value.defineProperty('Array', function Array() { return _Array.of(this) }, true);
Value.defineProperty('Map', function Map(index: any) {
  return _Map.of(index, this);
});

Value.defineProperty('extends', function extend(constructor: Function) {
  const value = constructor;
  value[model_f] = true;
  for (let key in this) {
    const property = Object.getOwnPropertyDescriptor(this, key);
    if (property == null) continue ;
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

Value.defineProperty('clone',  function clone(modifier?: (a: any) => any) {
  const Constructor = function This(input: any): any {
    (<any>This)._name = this.constructor.name;
    return (<any>This).from(input);
  };
  const value = this.extends(Constructor);
  if (modifier) modifier(value);
  return value;
});

Value.defineProperty('of', function of(model?: any, ...rest: any[]) {
  if (model && model[model_f]) return model;
  return this.clone((value: IValue) => value._value = model);
});

Value.defineProperty('opt', function opt() {
  return this.clone((value: IValue) => value._optional = true);
});

Value.defineProperty('init', function init(defValue: any) {
  return this.clone((value: IValue) => {
    value._optional = false;
    value._default  = typeof defValue === 'function' ? defValue : () => defValue;
  });
});

Value.defineProperty('addCleaner', function addCleaner(cleaner: (a: any) => any) {
  return this.clone((value: IValue) => value._cleaners.push(cleaner));
});

Value.defineProperty('addCheck', function addCheck(check: any) {
  return this.clone((value: IValue) => {
    if (typeof check === 'function')
      value._checks.push({ test: check });
    else if (check && typeof check.test === 'function')
      value._checks.push(check);
    else
      value._checks.push({ test: (value: any) => value === check });
  });
});

Value.defineProperty('from', function from(value: any) {
  return this._value ? this._value.from(value) : value;
});

Value.defineProperty('default', function def() {
  if (this._optional || this._default == null) return null;
  return this._default();
});

Value.defineProperty('validate', function validate(value: any) {
  for (let i = 0; i < this._cleaners.length; i += 1)
    value = this._cleaners[i].call(this, value);
  for (let i = 0; i < this._checks.length; i += 1) {
    if (!this._checks[i].test(value)) {
      if (this._optional) return null;
      else throw new Error('value "' + value + '" do not satisfy checks');
    }
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
_Boolean.defineProperty('_default', () => false);
_Boolean.defineProperty('_true', new Set(['y', 'yes', 'true']));
_Boolean.defineProperty('_false', new Set(['n', 'no', 'false']));

_Boolean.defineProperty('from', function from(value: any) {
  if (value == null) return this.default();
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
export interface INumber extends IValue {
  between(min: number, max: number): this;
}

export const _Number = <INumber>Value.extends(function Number() {});

_Number.defineProperty('_default', () => 0);

_Number.defineProperty('between', function between(min: number, max: number) {
  return this.addCheck(function (value: number) {
    return value >= min && value <= max;
  });
});

_Number.defineProperty('from', function from(value: any) {
  if (value == null) return this.default();
  return this.validate(parseFloat(value));
});

// String
export interface IString extends IValue {}

export const _String = <IString>Value.extends(function String() {});

_String.defineProperty('_default', () => '');

_String.defineProperty('from', function from(value: any) {
  if (value == null) return this.default();
  return this.validate(String(value));
});

// ID
export interface IID extends IValue {}

export const ID = <IID>Value.extends(function ID() {});

ID.defineProperty('_default', () => uuid());

ID.defineProperty('from', function from(value: any) {
  if (typeof value === 'number' && value > 0) return this.validate(value);
  if (typeof value === 'string' && value.length > 0) return this.validate(value);
  if (value && value.ID) return this.from(value.ID);
  return this.default();
});

// Enum
export interface IEnum extends IValue {
  _either: Set<IValue>;
}

export const Enum = <IEnum>Value.extends(function Enum() {});

Enum.defineProperty('_either', new Set());
Enum.defineProperty('_default', function () { return this._either.values().next().value });

Enum.defineProperty('of', function of(...args: any[]) {
  return this.clone((value: IEnum) => value._either = new Set(args));
});

Enum.defineProperty('from', function from(value: any) {
  if (this._either.has(value)) return this.validate(value);
  return this.default();
});

// Record
export interface IRecord extends IValue {
  _object: Map<string, IValue>;
  _constructor: { new (): Object };
  add(field: string, type: any): this;
  either(...a: Array<Array<string> | string>): this;
}

export const Record = <IRecord>Value.extends(function Record() {});
Record._object = new Map();

Record.defineProperty('of', function of(model: { [name: string]: any }) {
  const record = this.clone();
  for (const field in model) {
    if (model[field] instanceof Array)
      record._object.set(field, Value.of(...model[field]));
    else
      record._object.set(field, Value.of(model[field]));
  }
  return record;
});

Record.defineProperty('either', function either(...args: Array<Array<string> | string>) {
  return this.addCheck((data: Object) => {
    either: for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === 'string') {
        if (data[arg] != null)
          return true;
      } else if (arg instanceof Array) {
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

Record.defineProperty('add', function add(field: string, type: any) {
  const record = this.clone();
  record._object.set(field, Value.of(type));
  return record;
});

Record.defineProperty('from', function from(data: any) {
  if (data && data instanceof Object) {
    if (this._constructor == null)
      this._constructor = this._name ? eval('(function ' + this._name + '() {})') : Object;
    const record = <any>new this._constructor();
    for (const [name, type] of this._object) {
      try { record[name] = type.from(data[name]); }
      catch (e) {
        throw new Error('Failed on field: ' + name + ': ' + JSON.stringify(data[name]) + '\n' + String(e));
      }
    }
    return this.validate(record);
  } else {
    return this.default();
  }
});

Record.defineProperty('default', function def() {
  return this._optional ? null : this.from({});
});

// Entity
export interface IEntity extends IRecord {
  ID: IID;
  ByID: IMap;
}

export const Entity = <IEntity>Record.extends(function Entity() {})
  .add('ID', ID);

Entity.defineProperty('ID', () => ID, true);
Entity.defineProperty('ByID', function ByID() { return _Map.of(this.ID, this); }, true);

// Aggregate
export interface IAggregate extends IEntity {}

export const Aggregate = <IAggregate>Entity.extends(function Aggregate() {});

Aggregate.defineProperty('Set',   () => {
  throw new Error('Forbidden to create Set from Aggregate')
}, true);
Aggregate.defineProperty('Array', () => {
  throw new Error('Forbidden to create Array from Aggregate')
}, true);
Aggregate.defineProperty('Map',   (index: any) => {
  throw new Error('Forbidden to create Map from Aggregate')
});
Aggregate.defineProperty('ByID',  () => {
  throw new Error('Forbidden to create Map By ID from Aggregate')
}, true);

// ------------------------------------------

// Email
export interface IEmail extends IString {}

export const _Email = <IEmail>_String.extends(function Email() {})
  .addCheck(/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/);

// Date
export interface IDate extends IString {
  defNow(): this;
}

export const _Date = <IDate>_String.extends(function Date() {});

_Date.defineProperty('_default', () => '0000-00-00');

_Date.defineProperty('from', function from(value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(0, 10));
  else if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
});

_Date.defineProperty('defNow', function defNow() {
  return this.clone((date: IDate) => {
    date._default = () => new Date().toISOString().substr(0, 10);
  });
});

// Time
export interface ITime extends IString {
  defNow(): this;
}

export const _Time = <ITime>_String.extends(function Time() {});

_Time.defineProperty('_default', () => '00:00:00');

_Time.defineProperty('from', function from(value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString().substr(11, 12));
  if (/^\d{2}-\d{2}-\d{2}(\.\d{3})?(Z|[+\-]\d+)?$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
});

_Time.defineProperty('defNow', function defNow() {
  return this.clone((time: ITime) => {
    time._default = () => new Date().toISOString().substr(11, 12);
  });
});

// DateTime
export interface IDateTime extends IString {
  defNow(): this;
}

export const _DateTime = <IDateTime>_String.extends(function DateTime() {})
  .addCleaner(function (value: string) {
    const date = /^\d{4}(-\d\d){2}( |T)(\d\d)(:\d\d){2}(\.\d{3})?(Z|[+\-]\d+)?$/.exec(value);
    if (!date) return this.default();
    if (date[6] && date[6] != 'Z') {
      const idate = new Date(value).toISOString();
      return idate.substr(0, 10) + ' ' + idate.substr(11, 12);
    } else {
      return value.substr(0, 10) + ' ' + value.substr(11, 12);
    }
  });

_DateTime.defineProperty('_default', () => '0000-00-00 00:00:00');

_DateTime.defineProperty('from', function from(value: any) {
  if (value instanceof Date)
    return this.validate(value.toISOString());
  else if (/^\d{4}(-\d\d){2}( |T)\d\d(:\d\d){2}(\.\d{3})?(Z|[+\-]\d+)?$/.test(value))
    return this.validate(String(value));
  else
    return this.default();
});

_DateTime.defineProperty('defNow', function defNow() {
  return this.clone((datetime: IDateTime) => {
    datetime._default = () => new Date().toISOString().substr(0, 23).replace('T', ' ');
  });
});

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

//----------------------------------------------------------

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
  if (this._optional) return null;
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

_Array.defineProperty('default', function def() {
  if (this._optional) return null;
  return new Array();
});

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
  if (this._optional) return null;
  const map = new Map();
  map.toJSON = this.toJSON;
  return map;
});

_Map.defineProperty('toJSON', function () {
  return Array.from(this);
});
