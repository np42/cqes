/// <reference types="node" />
declare class Query<D> {
    view: string;
    createdAt: Date;
    method: string;
    data: D;
    meta: any;
    constructor(view: string, method: string, data: D, meta?: Object);
}
export declare type QueryReplier = (type: ReplyType, value: any) => void;
export declare class InQuery<D> extends Query<D> {
    private reply;
    pulledAt: Date;
    constructor(reply: QueryReplier, view: string, method: string, data?: D, meta?: Object);
    resolve(content: any): void;
    reject(error: string): void;
}
export declare class OutQuery<D> extends Query<D> {
    serialize(): Buffer;
}
export declare enum ReplyType {
    Resolved = "resolve",
    Rejected = "reject"
}
declare class Reply<D> {
    type: ReplyType;
    error: string;
    data: D;
    constructor(error: string, data?: D);
}
export declare class InReply<D> extends Reply<D> {
    pulledAt: Date;
    constructor(error: string, data?: D);
}
export declare class OutReply<D> extends Reply<D> {
    serialize(): Buffer;
}
export {};
