"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Facet {
    parse(input) { return null; }
    stringify(value) { return ''; }
}
exports.Facet = Facet;
class Value {
    constructor(data) {
        this.data = data;
    }
    toString() {
        return ''.constructor(this.data);
    }
}
exports.Value = Value;
class Chunk extends Value {
    constructor(data) {
        super(data);
    }
}
exports.Chunk = Chunk;
class Any extends Facet {
    constructor(types, Producer = AnyContent) {
        super();
        this.producer = new Producer(types);
    }
    parse(input) {
        let offset = 0;
        const chunk = new Chunk();
        chunk.data = {};
        while (offset < input.length) {
            const part = this.producer.parse(input.substr(offset));
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
    }
    stringify(value) {
        const result = [];
        for (const key in value.data) {
            const chunk = new Chunk();
            chunk.name = key;
            chunk.data = new Value(value.data[key]);
            result.push(this.producer.stringify(chunk));
        }
        return result.join('');
    }
}
exports.Any = Any;
class AnyContent {
    constructor(types) {
        this.types = types;
    }
    parse(input) {
        for (const [key, facet] of this.types) {
            const chunk = facet.parse(input);
            if (chunk != null)
                return chunk;
        }
        return null;
    }
    stringify(chunk) {
        const type = this.types.get(chunk.name);
        if (type == null)
            return '';
        return type.stringify(chunk.data);
    }
}
exports.AnyContent = AnyContent;
class May extends Facet {
    constructor(facet) {
        super();
        this.facet = facet;
    }
    parse(input) {
        const result = this.facet.parse(input);
        if (result != null)
            return result;
        const value = new Value();
        value.length = 0;
        value.data = null;
        return value;
    }
}
exports.May = May;
class OrderedRecord extends Facet {
    constructor(types, Producer = OrderedRecordContent) {
        super();
        this.producer = new Producer(types);
    }
    parse(input) {
        let offset = 0;
        let index = 0;
        const value = new Value();
        value.data = {};
        while (offset < input.length && index >= 0) {
            const part = this.producer.parse(input.substr(offset), index);
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
    }
}
exports.OrderedRecord = OrderedRecord;
class OrderedRecordContent {
    constructor(types) {
        this.list = types;
    }
    parse(input, index) {
        if (this.list[index] == null)
            return null;
        const value = this.list[index].parse(input);
        if (value == null)
            return null;
        const chunk = value;
        chunk.index = index + 1 < this.list.length ? index + 1 : -1;
        return chunk;
    }
}
exports.OrderedRecordContent = OrderedRecordContent;
class NamedValue extends Facet {
    constructor(name, facet) {
        super();
        this.name = name;
        this.facet = facet;
    }
    parse(input) {
        const value = this.facet.parse(input);
        const chunk = new Chunk(value.data);
        chunk.length = value.length;
        chunk.name = this.name;
        return chunk;
    }
}
exports.NamedValue = NamedValue;
class Number extends Facet {
    constructor(length = Infinity, base = 10) {
        super();
        this.length = length;
        this.base = base;
    }
    parse(input) {
        const string = input.substr(0, this.length);
        const value = new Value(parseInt(string, this.base));
        value.length = string.length;
        return value;
    }
    stringify(value) {
        return value.data.toString(this.base);
    }
}
exports.Number = Number;
class String extends Facet {
    constructor(length = Infinity) {
        super();
        this.length = length;
    }
    parse(input) {
        const string = input.substr(0, this.length);
        const value = new Value(string);
        value.length = string.length;
        return value;
    }
    stringify(value) {
        return value.data;
    }
}
exports.String = String;
class Enum extends Facet {
    constructor(map, length = Infinity) {
        super();
        this.map = map;
        this.length = length;
    }
    parse(input) {
        const string = input.substr(0, this.length);
        const mapped = this.map[string];
        const value = new Value(mapped != null ? mapped : string);
        value.length = input.length;
        return value;
    }
    stringify(value) {
        return value.data;
    }
}
exports.Enum = Enum;
//# sourceMappingURL=Lx.js.map