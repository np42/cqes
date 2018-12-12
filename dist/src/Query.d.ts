/// <reference types="node" />
import { Status } from './Reply';
export declare class Query {
    view: string;
    method: string;
    createdAt: Date;
    data: any;
    meta: any;
    constructor(view: string, method: string, data: any, meta?: any);
}
export declare type QueryReplier = (type: Status, value: any) => void;
export declare class InQuery extends Query {
    private reply;
    pulledAt: Date;
    constructor(reply: QueryReplier, view: string, method: string, data?: any, meta?: any);
    resolve(content: any): void;
    reject(content: any): void;
}
export declare class OutQuery extends Query {
    serialize(): Buffer;
}
