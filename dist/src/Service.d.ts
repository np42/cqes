import Logger from './Logger';
import { Fx } from './Fx';
import { CQESBus } from './CQESBus';
import { InCommand, OutCommand, CommandData } from './Command';
import { OutEvent } from './Event';
import { State, StateData } from './State';
export interface IService {
    new (config: any): Service;
    name: string;
}
export interface Service {
    new (config: any): Service;
    name: string;
}
export declare type Automate = (state: State<any>, command: InCommand<any>) => Promise<AutomateResponse>;
export declare type AutomateResponse = Array<OutCommand<any>>;
export declare type TypesSet = {
    [key: string]: any;
};
export declare type Applicant = {
    [key: string]: any;
};
export declare class Service {
    name: string;
    private _name;
    protected color: string;
    private _color;
    protected config: any;
    protected logger: Logger;
    protected bus: CQESBus;
    protected stream: Fx<any, any>;
    constructor(config: any);
    protected dispatch(state: State<any>, command: InCommand<any>): Promise<void>;
    stop(): void;
    protected request(commands: Array<OutCommand<any>>): Promise<void>;
    protected listen<S extends StateData, C extends CommandData>(topic: string, state: State<S>, types: TypesSet, applicant?: Applicant): Promise<Fx<any, any>>;
    protected publish(events: Array<OutEvent<any>>): Promise<void>;
    protected rehydrate<D extends StateData>(stream: string, StateDataClass: new (_: any) => D, process?: string): Fx<{}, any>;
    protected subscribe<D extends StateData>(stream: string, state: State<D>): Fx<any, import("./EventBus").Subscription>;
    protected last(stream: string, count: number): Promise<import("./Event").InEvent<any>[]>;
    protected watch<D extends StateData>(pstream: string, StateDataClass: new (_: any) => D, automates: AutomateCollection): Fx<any, import("./EventBus").Subscription>;
    protected query(view: string, method: string, data: any): Promise<any>;
    protected serve<D extends StateData>(view: string, state: State<D>, handlers: any): Fx<any, any>;
}
export declare class AutomateCollection {
    private automates;
    constructor();
    onAll(automate: Automate): void;
    on(names: string | Array<string>, automate: Automate): void;
    get(name: string): Automate[];
}
