import { CommandReplier } from './Command';
import { InQuery, InReply } from './Query';
import { Message } from 'amqplib';
export declare class AMQPInQuery<D> extends InQuery<D> {
    constructor(message: Message, reply: CommandReplier);
}
export declare class AMQPInReply<D> extends InReply<D> {
    id: string;
    constructor(message: Message);
}
