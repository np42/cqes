import { InCommand, CommandReplier, CommandData } from './Command';
import { Message } from 'amqplib';
export declare class AMQPInCommand<D extends CommandData> extends InCommand<D> {
    constructor(message: Message, reply: CommandReplier);
    cancel(reason?: any): void;
}
