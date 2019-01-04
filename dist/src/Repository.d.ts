import * as Gateway from './Gateway';
import { Query } from './Query';
import { Event } from './Event';
import { Reply } from './Reply';
import { State } from './State';
export interface Props extends Gateway.Props {
}
export interface Children extends Gateway.Children {
}
export declare class Repository extends Gateway.Gateway {
    constructor(props: Props, children: Children);
    start(): Promise<boolean>;
    stop(): Promise<void>;
    save(state: State, events: Array<Event>): Promise<void>;
    empty(): any;
    load(key: string): Promise<State>;
    resolve(query: Query, buffer?: Map<string, State>): Promise<Reply>;
}
