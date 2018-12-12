import { Handler as CommandHandler } from './CommandBus';
import { InQuery, OutQuery } from './Query';
import { Reply } from './Reply';
export declare type Handler<T> = CommandHandler<T>;
export interface QueryBus {
    start(): Promise<boolean>;
    stop(): Promise<void>;
    serve(view: string, handler: Handler<InQuery>): void;
    query(query: OutQuery, timeout?: number): Promise<Reply>;
}
