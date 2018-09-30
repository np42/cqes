import { CommandBus } from './CommandBus';
import { QueryBus } from './QueryBus';
import { EventBus } from './EventBus';
import { StateBus } from './StateBus';
export interface Options {
    Commands: string;
    Queries: string;
    Events: string;
    States: string;
}
export declare class Bus {
    C: CommandBus;
    Q: QueryBus;
    E: EventBus;
    S: StateBus;
    constructor(config: Options);
    stop(): void;
}
