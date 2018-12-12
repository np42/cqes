/// <reference types="node" />
declare enum Status {
    INITIAL = 0,
    PENDING = 1,
    DISRUPTED = 2,
    READY = 3,
    ABORTED = 4
}
export declare type Node<N, B> = (value: N, fx: Fx<N, B>) => Promise<B>;
export declare type Action<N, B> = (value: B, fx: Fx<N, B>) => any;
export declare type Handler = (payload?: any) => void;
export declare type DisruptedNotification = {
    error: any;
    value: any;
};
export interface Options {
    name?: string;
    nocache?: boolean;
    trunk?: Fx<any, any>;
    nextRetry?: Array<number> | ((count: number) => number);
}
declare type PendingAction<N, B> = PendingActionSuccess<N, B> | PendingActionFailure<N, B>;
interface PendingActionSuccess<N, B> {
    action: Action<N, B>;
    resolve: (result: any) => void;
}
interface PendingActionFailure<N, B> {
    action: Action<N, B>;
    reject: (error: any) => void;
}
export declare class Fx<N, B> {
    static create(data: any, options?: Options): Fx<any, any>;
    static newName(): string;
    static wrapNextRetry(next: Array<number> | ((count: number) => number)): (count: number) => number;
    protected name: string;
    protected node: Node<N, B>;
    protected trunk: Fx<any, N>;
    protected branches: Map<string, Fx<B, any>>;
    protected pending: Array<PendingAction<N, B>>;
    protected bridge: Fx<any, any>;
    protected data: B;
    protected lastParent: number;
    protected nextRetry: (count: number) => number;
    protected retryCount: number;
    protected retrying: NodeJS.Timer;
    protected nocache: boolean;
    protected events: Map<string, Array<Handler>>;
    status: Status;
    constructor(node: Node<N, B>, options?: Options);
    on(event: string, fn: Handler): this;
    one(event: string, fn: Handler): void;
    off(event: string, fn: Handler): this;
    emit(event: string, payload?: any): this;
    open(propaged?: boolean): this;
    produce(param: N): Promise<B>;
    fulfill(data: B): void;
    failWith(error: Error | string, propaged?: boolean): void;
    abort(): void;
    value(): Promise<B>;
    and(continuity: Node<any, B>): this;
    get(name: string): Fx<any, any>;
    set(branch: Fx<B, any>): this;
    try(method: Action<N, B>, count?: number): Promise<any>;
    do(method: Action<N, B>): Promise<any>;
    pipe(node: Node<B, any>, options?: Options): Fx<B, any>;
    merge(node: Node<B, any>, options?: Options): Fx<B, any>;
}
export declare class FxWrap<N, B> extends Fx<any, B> {
    constructor(node: Node<N, B>, options?: Options);
    value(): Promise<any>;
    mayValue(): any;
    produce(value: any): Promise<B>;
    failWith(error: any): void;
    abort(): void;
}
export {};
