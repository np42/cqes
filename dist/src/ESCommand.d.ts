import { InCommand, CommandReplier, CommandData } from './Command';
import * as ES from 'node-eventstore-client';
export declare class ESInCommand<D extends CommandData> extends InCommand<D> {
    number: number;
    constructor(message: ES.RecordedEvent, reply: CommandReplier);
    ack(): void;
    cancel(): void;
}
