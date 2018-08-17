/// <reference types="node" />
declare class Event<D extends EventData> {
    stream: string;
    type: string;
    data: D;
    meta: any;
    number: any;
    constructor(stream: string, type: string, data?: D, meta?: any);
    readonly entityId: string;
}
export declare class InEvent<D extends EventData> extends Event<D> {
    createdAt: Date;
    constructor(stream: string, type: string, data?: D, meta?: any);
}
export declare class OutEvent<D extends EventData> extends Event<D> {
    constructor(stream: string, instance: D, meta?: any);
    serialize(): Buffer;
}
export declare class EventData {
    EventDataConstraint: Symbol;
}
export {};
