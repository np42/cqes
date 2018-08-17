import { CommandBus, Handler } from './CommandBus';
import { InCommand, OutCommand } from './Command';
import { AMQPBus } from './AMQPBus';
export declare class AMQPCommandBus extends AMQPBus implements CommandBus {
    constructor(url: string);
    listen(topic: string, handler: Handler<InCommand<any>>): import("./Fx").Fx<import("amqplib").Channel, any>;
    command(request: OutCommand<any>): Promise<any>;
}
