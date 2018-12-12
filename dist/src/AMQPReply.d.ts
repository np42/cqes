import { InReply } from './Reply';
import { Message } from 'amqplib';
export declare class AMQPInReply extends InReply {
    id: string;
    constructor(message: Message);
}
