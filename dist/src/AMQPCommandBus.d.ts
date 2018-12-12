import { AMQPBus } from './AMQPBus';
import { CommandBus, Handler } from './CommandBus';
import { InCommand, OutCommand } from './Command';
export interface Config {
    name: string;
    url: string;
}
export declare class AMQPCommandBus extends AMQPBus implements CommandBus {
    private id;
    private pending;
    private response;
    private gcInterval;
    constructor(config: Config);
    private gc;
    start(): Promise<boolean>;
    listen(topic: string, handler: Handler<InCommand>): Promise<{}>;
    request(request: OutCommand, timeout?: number): Promise<any>;
}
