import { EventBus } from './EventBus';
import { StateData } from './State';
import { MemoryState, Options } from './MemoryState';
export interface EventOptions extends Options {
    window?: number;
    process?: string;
}
export declare class EventMemoryState<D extends StateData> extends MemoryState<D> {
    protected StateDataClass: new (key: string) => D;
    protected bus: EventBus;
    protected window: number;
    process: string;
    constructor(StateDataClass: new (key: string) => D, bus: EventBus, options?: EventOptions);
    materialize(key: string): Promise<D>;
    get(key: string): Promise<D>;
}
