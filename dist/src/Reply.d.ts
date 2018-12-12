/// <reference types="node" />
export declare enum Status {
    Resolved = "resolve",
    Rejected = "reject"
}
export declare class Reply {
    status: Status;
    data: any;
    meta: any;
    constructor(error: string, data?: any, meta?: any);
    assert(): any;
    get(): any;
}
export declare class InReply extends Reply {
    pulledAt: Date;
    constructor(error: string, data?: any);
}
export declare class OutReply extends Reply {
    serialize(): Buffer;
}
