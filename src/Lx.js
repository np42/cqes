"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
// FACET
var Facet = /** @class */ (function () {
    function Facet() {
    }
    Facet.prototype.parse = function (input) { return null; };
    Facet.prototype.stringify = function (value) { return ''; };
    return Facet;
}());
exports.Facet = Facet;
// VALUE
var Value = /** @class */ (function () {
    function Value(data) {
        this.data = data;
    }
    Value.prototype.toString = function () {
        return ''.constructor(this.data);
    };
    return Value;
}());
exports.Value = Value;
// CHUNK
var Chunk = /** @class */ (function (_super) {
    __extends(Chunk, _super);
    function Chunk(data) {
        return _super.call(this, data) || this;
    }
    return Chunk;
}(Value));
exports.Chunk = Chunk;
//----------------------
// ANY
var Any = /** @class */ (function (_super) {
    __extends(Any, _super);
    function Any(types, Producer) {
        if (Producer === void 0) { Producer = AnyContent; }
        var _this = _super.call(this) || this;
        _this.producer = new Producer(types);
        return _this;
    }
    Any.prototype.parse = function (input) {
        var offset = 0;
        var chunk = new Chunk();
        chunk.data = {};
        while (offset < input.length) {
            var part = this.producer.parse(input.substr(offset));
            if (part != null) {
                if (part.name == null) {
                    if (chunk.data._ == null)
                        chunk.data._ = [];
                    chunk.data._.push(part.data);
                }
                else {
                    chunk.data[part.name] = part.data;
                }
                offset += part.length;
            }
            else {
                break;
            }
        }
        if (offset > 0) {
            chunk.length = offset;
            return chunk;
        }
        else {
            return null;
        }
    };
    Any.prototype.stringify = function (value) {
        var result = [];
        for (var key in value.data) {
            var chunk = new Chunk();
            chunk.name = key;
            chunk.data = new Value(value.data[key]);
            result.push(this.producer.stringify(chunk));
        }
        return result.join('');
    };
    return Any;
}(Facet));
exports.Any = Any;
var AnyContent = /** @class */ (function () {
    function AnyContent(types) {
        this.types = types;
    }
    AnyContent.prototype.parse = function (input) {
        for (var _i = 0, _a = this.types; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], facet = _b[1];
            var chunk = facet.parse(input);
            if (chunk != null)
                return chunk;
        }
        return null;
    };
    AnyContent.prototype.stringify = function (chunk) {
        var type = this.types.get(chunk.name);
        if (type == null)
            return '';
        return type.stringify(chunk.data);
    };
    return AnyContent;
}());
exports.AnyContent = AnyContent;
var May = /** @class */ (function (_super) {
    __extends(May, _super);
    function May(facet) {
        var _this = _super.call(this) || this;
        _this.facet = facet;
        return _this;
    }
    May.prototype.parse = function (input) {
        var result = this.facet.parse(input);
        if (result != null)
            return result;
        var value = new Value();
        value.length = 0;
        value.data = null;
        return value;
    };
    return May;
}(Facet));
exports.May = May;
// OrderedRecord
var OrderedRecord = /** @class */ (function (_super) {
    __extends(OrderedRecord, _super);
    function OrderedRecord(types, Producer) {
        if (Producer === void 0) { Producer = OrderedRecordContent; }
        var _this = _super.call(this) || this;
        _this.producer = new Producer(types);
        return _this;
    }
    OrderedRecord.prototype.parse = function (input) {
        var offset = 0;
        var index = 0;
        var value = new Value();
        value.data = {};
        while (offset < input.length && index >= 0) {
            var part = this.producer.parse(input.substr(offset), index);
            if (part != null) {
                if (part.name == null) {
                    if (value.data._ == null)
                        value.data._ = [];
                    value.data._.push(part.data);
                }
                else {
                    value.data[part.name] = part.data;
                }
                offset += part.length;
                index = part.index;
            }
            else {
                return null;
            }
        }
        if (index == -1) {
            value.length = offset;
            return value;
        }
        else {
            return null;
        }
    };
    return OrderedRecord;
}(Facet));
exports.OrderedRecord = OrderedRecord;
var OrderedRecordContent = /** @class */ (function () {
    function OrderedRecordContent(types) {
        this.list = types;
    }
    OrderedRecordContent.prototype.parse = function (input, index) {
        if (this.list[index] == null)
            return null;
        var value = this.list[index].parse(input);
        if (value == null)
            return null;
        var chunk = value;
        chunk.index = index + 1 < this.list.length ? index + 1 : -1;
        return chunk;
    };
    return OrderedRecordContent;
}());
exports.OrderedRecordContent = OrderedRecordContent;
// NAMED VALUE
var NamedValue = /** @class */ (function (_super) {
    __extends(NamedValue, _super);
    function NamedValue(name, facet) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.facet = facet;
        return _this;
    }
    NamedValue.prototype.parse = function (input) {
        var value = this.facet.parse(input);
        var chunk = new Chunk(value.data);
        chunk.length = value.length;
        chunk.name = this.name;
        return chunk;
    };
    return NamedValue;
}(Facet));
exports.NamedValue = NamedValue;
// NUMBER
var Number = /** @class */ (function (_super) {
    __extends(Number, _super);
    function Number(length, base) {
        if (length === void 0) { length = Infinity; }
        if (base === void 0) { base = 10; }
        var _this = _super.call(this) || this;
        _this.length = length;
        _this.base = base;
        return _this;
    }
    Number.prototype.parse = function (input) {
        var string = input.substr(0, this.length);
        var value = new Value(parseInt(string, this.base));
        value.length = string.length;
        return value;
    };
    Number.prototype.stringify = function (value) {
        return value.data.toString(this.base);
    };
    return Number;
}(Facet));
exports.Number = Number;
// STRING
var String = /** @class */ (function (_super) {
    __extends(String, _super);
    function String(length) {
        if (length === void 0) { length = Infinity; }
        var _this = _super.call(this) || this;
        _this.length = length;
        return _this;
    }
    String.prototype.parse = function (input) {
        var string = input.substr(0, this.length);
        var value = new Value(string);
        value.length = string.length;
        return value;
    };
    String.prototype.stringify = function (value) {
        return value.data;
    };
    return String;
}(Facet));
exports.String = String;
// ENUM
var Enum = /** @class */ (function (_super) {
    __extends(Enum, _super);
    function Enum(map, length) {
        if (length === void 0) { length = Infinity; }
        var _this = _super.call(this) || this;
        _this.map = map;
        _this.length = length;
        return _this;
    }
    Enum.prototype.parse = function (input) {
        var string = input.substr(0, this.length);
        var mapped = this.map[string];
        var value = new Value(mapped != null ? mapped : string);
        value.length = input.length;
        return value;
    };
    Enum.prototype.stringify = function (value) {
        return value.data;
    };
    return Enum;
}(Facet));
exports.Enum = Enum;
