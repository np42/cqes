import { InEvent } from './Event';
import { State, StateData } from './State';
export interface Options {
    size?: number;
    ttl?: number;
}
export interface RecordOptions {
    ttl?: number;
    cost?: number;
}
export declare class MemoryState<D extends StateData> extends State<CacheMap<D>> {
    constructor(options?: Options);
}
declare class CacheMap<D extends StateData> extends StateData {
    private entries;
    private ttl;
    constructor(options: Options);
    get(key: string): D;
    set(key: string, value: D, options?: RecordOptions): void;
    delete(key: string): void;
    apply(events: InEvent<any> | Array<InEvent<any>>): void;
}
export {};
