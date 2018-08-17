import { State, StateData } from './State';
import { OutEvent, EventData } from './Event';
import * as ES from 'node-eventstore-client';
export declare class ESInState<D extends StateData> extends State<D> {
    constructor(StateDataClass: new (_: any) => D, message: ES.RecordedEvent);
}
export declare class ESOutState<D extends StateData> extends OutEvent<Snapshoted> {
    constructor(state: State<D>);
}
declare class Snapshoted extends EventData {
    position: number;
    timestamp: number;
    data: any;
    constructor(data: any);
}
export {};
