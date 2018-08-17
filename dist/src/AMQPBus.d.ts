/// <reference types="node" />
import { Fx } from './Fx';
import { Handler } from './CommandBus';
import * as amqp from 'amqplib';
export declare class AMQPBus {
    private connection;
    private channels;
    constructor(url: string);
    getChannel(queue: string, options: any): Fx<amqp.Connection, amqp.Channel>;
    consume(queue: string, handler: Handler<any>, options: any): Fx<amqp.Channel, any>;
    publish(queue: string, message: Buffer, options: any): Promise<any>;
}
