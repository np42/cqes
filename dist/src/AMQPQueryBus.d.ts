import { Fx } from './Fx';
import { Handler } from './CommandBus';
import { QueryBus } from './QueryBus';
import { InQuery, OutQuery } from './Query';
import { AMQPBus } from './AMQPBus';
import { Channel } from 'amqplib';
export declare class AMQPQueryBus extends AMQPBus implements QueryBus {
    private id;
    private pending;
    private queue;
    private gcInterval;
    constructor(url: string);
    private gc;
    private listenReply;
    serve(view: string, handler: Handler<InQuery<any>>): Fx<Channel, any>;
    query(request: OutQuery<any>, timeout?: number): Promise<{}>;
}
