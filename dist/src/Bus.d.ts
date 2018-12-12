import { Logger } from './Logger';
import { CommandBus, Handler as CommandHandler } from './CommandBus';
import { QueryBus, Handler as QueryHandler } from './QueryBus';
import { Config as CommandBusConfig } from './AMQPCommandBus';
import { Config as QueryBusConfig } from './AMQPQueryBus';
import { InCommand } from './Command';
import { InQuery } from './Query';
import { Reply } from './Reply';
export interface Props {
    name: string;
    Command: CommandBusConfig;
    Query: QueryBusConfig;
}
export interface Children {
}
export declare class Bus {
    logger: Logger;
    commandBus: CommandBus;
    queryBus: QueryBus;
    constructor(props: Props, children: Children);
    start(): Promise<boolean>;
    stop(): Promise<void>;
    command(key: string, order: string, data?: any, meta?: any): Promise<Reply>;
    listen(topic: string, handler: CommandHandler<InCommand>): void;
    query(view: string, method?: string, data?: any, meta?: any): Promise<Reply>;
    serve(view: string, handler: QueryHandler<InQuery>): void;
}
