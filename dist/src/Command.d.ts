/// <reference types="node" />
declare class Command<D extends CommandData> {
    topic: string;
    createdAt: Date;
    name: string;
    data: D;
    meta: any;
    constructor(topic: string, name: string, data?: D, meta?: Object);
}
export declare type CommandReplier = (action: string, reason?: any) => void;
export declare class InCommand<D extends CommandData> extends Command<D> {
    protected reply: CommandReplier;
    pulledAt: Date;
    constructor(reply: CommandReplier, topic: string, name: string, data?: D, meta?: Object);
    ack(): void;
    cancel(reason?: any): void;
}
export declare class OutCommand<D extends CommandData> extends Command<D> {
    constructor(topic: string, instance: D, meta?: any);
    serialize(): Buffer;
}
export declare class CommandData {
    CommandDataConstraint: Symbol;
}
export {};
