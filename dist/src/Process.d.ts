import * as Component from './Component';
import { Service } from './Service';
export declare class Process extends Component.Component {
    protected config: any;
    protected rootpath: string;
    protected environment: string;
    protected hostname: string;
    protected launcher: string;
    protected services: Map<string, Service>;
    constructor();
    private loadConstant;
    private loadConfig;
    private getConfig;
    private getConfigFileList;
    private configInflate;
    private configImport;
    private configReadYaml;
    private loadGroup;
    private createService;
    private safeRequire;
    run(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
}
