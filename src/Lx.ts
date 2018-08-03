// FACET
export class Facet<T> {
  parse(input: string): T { return null }
  stringify(value: T) { return '' }
}

// VALUE
export class Value {
  public data: any;
  public length: number;

  constructor(data?: any) {
    this.data = data;
  }

  toString() {
    return ''.constructor(this.data);
  }
}

// CHUNK
export class Chunk extends Value {
  public name:   string;
  public index:  number;

  constructor(data?: any) {
    super(data);
  }
}

//----------------------

// ANY
export class Any extends Facet<Chunk> {
  public producer: AnyContent;

  constructor(types: Map<string, Facet<Chunk>>, Producer: typeof AnyContent = AnyContent) {
    super();
    this.producer = new Producer(types);
  }

  parse(input: string) {
    let offset = 0;
    const chunk = new Chunk();
    chunk.data = <any>{};
    while (offset < input.length) {
      const part = this.producer.parse(input.substr(offset));
      if (part != null) {
        if (part.name == null) {
          if (chunk.data._ == null) chunk.data._ = [];
          chunk.data._.push(part.data);
        } else {
          chunk.data[part.name] = part.data;
        }
        offset += part.length;
      } else {
        break ;
      }
    }
    if (offset > 0) {
      chunk.length = offset;
      return chunk;
    } else {
      return null
    }
  }

  stringify(value: Value) {
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

export class AnyContent {
  public types: Map<string, Facet<Chunk>>;

  constructor(types: Map<string, Facet<Chunk>>) {
    this.types = types;
  }

  parse(input: string) {
    for (const [key, facet] of this.types) {
      const chunk = facet.parse(input);
      if (chunk != null) return chunk;
    }
    return null;
  }

  stringify(chunk: Chunk) {
    const type = this.types.get(chunk.name);
    if (type == null) return '';
    return type.stringify(chunk.data);
  }
}

export class May<T extends Value | Value> extends Facet<T | Value> {
  public facet: Facet<T>;

  constructor(facet: Facet<T>) {
    super();
    this.facet = facet;
  }

  parse(input: string) {
    const result = this.facet.parse(input);
    if (result != null) return result;
    const value = new Value();
    value.length = 0;
    value.data = null;
    return value;
  }
}

// OrderedRecord
export class OrderedRecord extends Facet<Value> {
  public producer: OrderedRecordContent;

  constructor(types: Array<Facet<Chunk>>, Producer: typeof OrderedRecordContent = OrderedRecordContent) {
    super();
    this.producer = new Producer(types);
  }

  parse(input: string) {
    let offset = 0;
    let index  = 0;
    const value = new Value();
    value.data  = <any>{};
    while (offset < input.length && index >= 0) {
      const part = this.producer.parse(input.substr(offset), index);
      if (part != null) {
        if (part.name == null) {
          if (value.data._ == null) value.data._ = [];
          value.data._.push(part.data);
        } else {
          value.data[part.name] = part.data;
        }
        offset += part.length;
        index = part.index;
      } else {
        return null;
      }
    }
    if (index == -1) {
      value.length = offset;
      return value;
    } else {
      return null;
    }
  }
}

export class OrderedRecordContent {
  public list: Array<Facet<Value>>;

  constructor(types: Array<Facet<Value>>) {
    this.list = types;
  }

  parse(input: string, index: number) {
    if (this.list[index] == null) return null;
    const value = this.list[index].parse(input);
    if (value == null) return null;
    const chunk: Chunk = <any>value;
    chunk.index = index + 1 < this.list.length ? index + 1 : -1
    return chunk;
  }
}

// NAMED VALUE
export class NamedValue extends Facet<Chunk> {
  public name: string;
  public facet: Facet<Value>;

  constructor(name: string, facet: Facet<Value>) {
    super();
    this.name  = name;
    this.facet = facet;
  }

  parse(input: string) {
    const value = this.facet.parse(input);
    const chunk = new Chunk(value.data);
    chunk.length = value.length;
    chunk.name = this.name;
    return chunk;
  }
}

// NUMBER
export class Number extends Facet<Value> {
  public length: number;
  public base: number;

  constructor(length: number = Infinity, base: number = 10) {
    super();
    this.length = length;
    this.base = base;
  }

  parse(input: string) {
    const string = input.substr(0, this.length);
    const value = new Value(parseInt(string, this.base));
    value.length = string.length;
    return value;
  }

  stringify(value: Value) {
    return value.data.toString(this.base);
  }
}

// STRING
export class String extends Facet<Value> {
  public length: number;

  constructor(length: number = Infinity) {
    super();
    this.length = length;
  }

  parse(input: string) {
    const string = input.substr(0, this.length);
    const value = new Value(string);
    value.length = string.length;
    return value;
  }

  stringify(value: Value) {
    return value.data;
  }
}

// ENUM
export class Enum extends Facet<Value> {
  public length: number;
  public map: any;

  constructor(map: any, length: number = Infinity) {
    super();
    this.map = map;
    this.length = length;
  }

  parse(input: string) {
    const string = input.substr(0, this.length);
    const mapped = this.map[string];
    const value  = new Value(mapped != null ? mapped : string);
    value.length = input.length;
    return value;
  }

  stringify(value: Value) {
    return value.data;
  }
}