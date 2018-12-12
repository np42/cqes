import { InCommand, CommandReplier } from './Command';
import { Message } from 'amqplib';
export declare class AMQPInCommand extends InCommand {
    constructor(message: Message, reply: CommandReplier);
    cancel(reason?: any): void;
}
