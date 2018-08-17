import { Fx } from './Fx';
import { InEvent, OutEvent } from './Event';
import { InCommand } from './Command';
export interface Subscription {
    stop: () => void;
}
export declare type FxSubscription = Fx<any, Subscription>;
export declare type FxMessageHandler<T> = Fx<any, MessageHandler<T>>;
export declare type MessageHandler<T> = (message: T) => Promise<void>;
export declare type Handler<T> = MessageHandler<T> | FxMessageHandler<T>;
export interface EventBus {
    publish(stream: string, position: any, events: Array<OutEvent<any>>): Promise<any>;
    last(stream: string, count: number): Promise<Array<InEvent<any>>>;
    subscribe(stream: string, position: any, handler: Handler<InEvent<any>>): FxSubscription;
    consume(topic: string, handler: Handler<InCommand<any>>): FxSubscription;
}
