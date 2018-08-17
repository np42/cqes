import { InEvent } from './Event';
export declare class State<D extends StateData> {
    process: string;
    position: any;
    data: D;
    constructor(StateDataClass?: new (_: any) => D, data?: any, position?: any);
}
export declare class StateData {
    id: string;
    protected type(event: InEvent<any>): InEvent<any>;
    apply(events: InEvent<any> | Array<InEvent<any>>): void;
    toString(): string;
}
