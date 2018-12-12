import * as Component from './Component';
import * as Service from './Service';
import * as Manager from './Manager';
import * as Buffer from './Buffer';
import * as Responder from './Responder';
import * as Reactor from './Reactor';
import { Command } from './Command';
import { Query } from './Query';
import { Reply } from './Reply';
export interface Props extends Component.Props {
    tryCount?: number;
    Manager?: Manager.Props;
    Buffer?: Buffer.Props;
    Responder?: Responder.Props;
    Reactor?: Reactor.Props;
}
export interface Children extends Component.Children {
    Manager: {
        new (props: Manager.Props, children: Manager.Children): Manager.Manager;
    };
    Buffer: {
        new (props: Buffer.Props, children: Buffer.Children): Buffer.Buffer;
    };
    Responder: {
        new (props: Responder.Props, children: Responder.Children): Responder.Responder;
    };
    Reactor: {
        new (props: Reactor.Props, children: Reactor.Children): Reactor.Reactor;
    };
}
export declare class Aggregator extends Component.Component implements Service.Handler {
    manager: Manager.Manager;
    buffer: Buffer.Buffer;
    responder: Responder.Responder;
    reactor: Reactor.Reactor;
    constructor(props: Props, children: Children);
    start(): Promise<boolean>;
    stop(): Promise<void>;
    handle(command: Command): Promise<Reply>;
    resolve(query: Query): Promise<Reply>;
}
