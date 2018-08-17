import { Service, IService } from './Service';
export default class Process extends Service {
    static nameOf(path: string): string;
    private argv;
    private loading;
    private services;
    rootpath: string;
    environment: string;
    hostname: string;
    launcher: string;
    constructor();
    private loadConstant;
    setConfig(config: any): void;
    registerService(Module: IService): void;
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
