import { AMQPBus } from './AMQPBus';
import { QueryBus } from './QueryBus';
import { Handler } from './CommandBus';
import { InQuery, OutQuery } from './Query';
import { Reply } from './Reply';
export interface Config {
    name: string;
    url: string;
}
export declare class AMQPQueryBus extends AMQPBus implements QueryBus {
    private id;
    private pending;
    private response;
    private gcInterval;
    constructor(config: Config);
    private gc;
    start(): Promise<boolean>;
    serve(view: string, handler: Handler<InQuery>): Promise<{}>;
    query(request: OutQuery, timeout?: number): Promise<Reply>;
}
