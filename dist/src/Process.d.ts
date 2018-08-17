import { Service, IService } from './Service';
declare enum ActionTypes {
    LoadMainConfig = 0,
    SetConfig = 1,
    RegisterService = 2
}
interface Task {
    type: ActionTypes;
    payload: any;
}
declare const _default: {
    new (config: any): Service;
    argv: any;
    loading: Task[];
    services: Map<string, Service>;
    rootpath: string;
    environment: string;
    hostname: string;
    launcher: string;
    loadConstant(): void;
    setConfig(config: any): void;
    registerService(Module: IService): void;
    run(): Promise<void>;
    nextTick(): Promise<void>;
    getConfigFileList(): string[];
    getConfig(directory: string): Promise<any>;
    loadMainConfig(rootpath: string): Promise<void>;
    loadCustomConfig(config: any): Promise<void>;
    getModuleConfig(name: string, type: string): Promise<any>;
    resolve(data: any): any;
    loadService(Module: Service): Promise<void>;
    name: string;
    _name: {
        toString: () => string;
        toJSON: () => any;
    };
    color: string;
    _color: {
        toString: () => string;
    };
    config: any;
    logger: import("./Logger").default;
    bus: import("./CQESBus").CQESBus;
    stream: import("./Fx").Fx<any, any>;
    dispatch(state: import("./State").State<any>, command: import("./Command").InCommand<any>): Promise<void>;
    stop(): void;
    request(commands: import("./Command").OutCommand<any>[]): Promise<void>;
    listen<S extends import("./State").StateData, C extends import("./Command").CommandData>(topic: string, state: import("./State").State<S>, types: import("./Service").TypesSet, applicant?: import("./Service").Applicant): Promise<import("./Fx").Fx<any, any>>;
    publish(events: import("./Event").OutEvent<any>[]): Promise<void>;
    rehydrate<D extends import("./State").StateData>(stream: string, StateDataClass: new (_: any) => D, process?: string): import("./Fx").Fx<{}, any>;
    subscribe<D extends import("./State").StateData>(stream: string, state: import("./State").State<D>): import("./Fx").Fx<any, import("./EventBus").Subscription>;
    last(stream: string, count: number): Promise<import("./Event").InEvent<any>[]>;
    watch<D extends import("./State").StateData>(pstream: string, StateDataClass: new (_: any) => D, automates: import("./Service").AutomateCollection): import("./Fx").Fx<any, import("./EventBus").Subscription>;
    query(view: string, method: string, data: any): Promise<any>;
    serve<D extends import("./State").StateData>(view: string, state: import("./State").State<D>, handlers: any): import("./Fx").Fx<any, any>;
};
export default _default;
