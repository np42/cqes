/// <reference types="node" />
export declare class Command {
    key: string;
    order: string;
    createdAt: Date;
    data: any;
    meta: any;
    constructor(key: string, order: string, data?: any, meta?: any);
    readonly id: string;
}
export declare type CommandReplier = (action: string, reason?: any) => void;
export declare class InCommand extends Command {
    protected reply: CommandReplier;
    pulledAt: Date;
    constructor(reply: CommandReplier, key: string, order: string, data?: any, meta?: any);
    resolve(content: any): void;
    reject(content: any): void;
    cancel(reason?: string): void;
}
export declare class OutCommand extends Command {
    constructor(key: string, order: string, data: any, meta?: any);
    serialize(): Buffer;
}
