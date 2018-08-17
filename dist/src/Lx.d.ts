export declare class Facet<T> {
    parse(input: string): T;
    stringify(value: T): string;
}
export declare class Value {
    data: any;
    length: number;
    constructor(data?: any);
    toString(): any;
}
export declare class Chunk extends Value {
    name: string;
    index: number;
    constructor(data?: any);
}
export declare class Any extends Facet<Chunk> {
    producer: AnyContent;
    constructor(types: Map<string, Facet<Chunk>>, Producer?: typeof AnyContent);
    parse(input: string): Chunk;
    stringify(value: Value): string;
}
export declare class AnyContent {
    types: Map<string, Facet<Chunk>>;
    constructor(types: Map<string, Facet<Chunk>>);
    parse(input: string): Chunk;
    stringify(chunk: Chunk): string;
}
export declare class May<T extends Value | Value> extends Facet<T | Value> {
    facet: Facet<T>;
    constructor(facet: Facet<T>);
    parse(input: string): Value;
}
export declare class OrderedRecord extends Facet<Value> {
    producer: OrderedRecordContent;
    constructor(types: Array<Facet<Chunk>>, Producer?: typeof OrderedRecordContent);
    parse(input: string): Value;
}
export declare class OrderedRecordContent {
    list: Array<Facet<Value>>;
    constructor(types: Array<Facet<Value>>);
    parse(input: string, index: number): Chunk;
}
export declare class NamedValue extends Facet<Chunk> {
    name: string;
    facet: Facet<Value>;
    constructor(name: string, facet: Facet<Value>);
    parse(input: string): Chunk;
}
export declare class Number extends Facet<Value> {
    length: number;
    base: number;
    constructor(length?: number, base?: number);
    parse(input: string): Value;
    stringify(value: Value): any;
}
export declare class String extends Facet<Value> {
    length: number;
    constructor(length?: number);
    parse(input: string): Value;
    stringify(value: Value): any;
}
export declare class Enum extends Facet<Value> {
    length: number;
    map: any;
    constructor(map: any, length?: number);
    parse(input: string): Value;
    stringify(value: Value): any;
}
