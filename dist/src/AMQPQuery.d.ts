import { CommandReplier } from './Command';
import { InQuery } from './Query';
import { Message } from 'amqplib';
export declare class AMQPInQuery extends InQuery {
    constructor(message: Message, reply: CommandReplier);
}
