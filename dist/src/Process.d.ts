declare type Service = any;
export declare class Process {
    static nameOf(path: string): string;
    name: string;
    private config;
    private argv;
    private logger;
    private loading;
    private services;
    rootpath: string;
    environment: string;
    hostname: string;
    launcher: string;
    constructor();
    private loadConstant;
    setConfig(config: any): void;
    registerService(Module: Service): void;
    run(): Promise<void>;
    private nextTick;
    private getConfigFileList;
    private getConfig;
    private loadMainConfig;
    private loadCustomConfig;
    getModuleConfig(name: string, type: string): Promise<any>;
    private resolve;
    private loadService;
}
export {};
