import { InEvent, EventData } from './Event';
import * as ES from 'node-eventstore-client';
export declare class ESInEvent<D extends EventData> extends InEvent<D> {
    constructor(message: ES.RecordedEvent, original?: ES.RecordedEvent);
}
