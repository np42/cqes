export declare class State {
    key: string;
    version: number;
    status: string;
    data: any;
    constructor(key: string, version?: number, status?: string, data?: any);
    readonly id: string;
    next(status?: string, partial?: any): State;
    end(): State;
}
