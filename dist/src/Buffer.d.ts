import * as Component from './Component';
import * as Repository from './Repository';
import * as Factory from './Factory';
import { State } from './State';
import { Event } from './Event';
import { Query } from './Query';
import { Reply } from './Reply';
declare const CachingMap: any;
export interface Props extends Component.Props {
    size?: number;
    ttl?: number;
    Repository?: Repository.Props;
    Factory?: Factory.Props;
}
export interface Children extends Component.Children {
    Repository: {
        new (props: Repository.Props, children: Repository.Children): Repository.Repository;
    };
    Factory: {
        new (props: Factory.Props, children: Factory.Children): Factory.Factory;
    };
}
interface CachingMap<K, V> {
    set(key: K, value: V, options?: {
        ttl?: number;
    }): void;
    get(key: K): V;
    delete(key: K): void;
}
export declare class Buffer extends Component.Component {
    protected buffer: CachingMap<string, State>;
    protected ttl: number;
    repository: Repository.Repository;
    factory: Factory.Factory;
    constructor(props: Props, children: Children);
    get(key: string): Promise<State>;
    update(key: string, expectedVersion: number, events: Array<Event>): any;
    resolve(query: Query): Promise<Reply>;
    start(): Promise<boolean>;
    stop(): Promise<void>;
}
export {};
