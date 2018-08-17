import { Fx } from './Fx';
import { EventBus, Handler } from './EventBus';
import { InEvent, OutEvent } from './Event';
import { InCommand } from './Command';
import { StateBus } from './StateBus';
import { State, StateData } from './State';
import * as ES from 'node-eventstore-client';
export declare class ESBus implements EventBus, StateBus {
    private credentials;
    private connection;
    constructor(url: string, settings?: {});
    publish(stream: string, position: number, events: Array<OutEvent<any>>): Promise<any>;
    subscribe(stream: string, from: number, handler: Handler<InEvent<any>>): Fx<ES.EventStoreNodeConnection, any>;
    consume(topic: string, handler: Handler<InCommand<any>>): Fx<ES.EventStoreNodeConnection, any>;
    restore<D extends StateData>(StateDataClass: new (_: any) => D, process?: string): Promise<State<D>>;
    save<D extends StateData>(state: State<D>): Promise<any>;
    last(stream: string, count: number, wrapper?: (event: any) => any): Promise<any>;
    tweak(stream: string, version: number, metadata: Object): Promise<any>;
}
