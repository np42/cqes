/// <reference types="node" />
import { Fx } from './Fx';
import { Handler } from './CommandBus';
import * as amqp from 'amqplib';
export declare type FxConnection = Fx<any, amqp.Connection>;
export interface Config {
    name: string;
    url: string;
}
export declare class AMQPBus {
    private url;
    private connection;
    private channels;
    private consumers;
    constructor(config: Config);
    start(): Promise<boolean>;
    stop(): Promise<void>;
    private getChannel;
    protected consume(queue: string, handler: Handler<any>, options: any): Promise<{}>;
    protected publish(queue: string, message: Buffer, options: any): Promise<any>;
}
