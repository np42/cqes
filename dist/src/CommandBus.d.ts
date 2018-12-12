import { Fx } from './Fx';
import { InCommand, OutCommand } from './Command';
import { Reply } from './Reply';
export interface Subscription {
    stop: () => void;
}
export declare type FxSubscription = Fx<any, Subscription>;
export declare type FxMessageHandler<T> = Fx<any, MessageHandler<T>>;
export declare type MessageHandler<T> = (message: T) => Promise<void>;
export declare type Handler<T> = MessageHandler<T> | FxMessageHandler<T>;
export interface CommandBus {
    start(): Promise<boolean>;
    stop(): Promise<void>;
    listen(topic: string, handler: Handler<InCommand>): void;
    request(request: OutCommand): Promise<Reply>;
}
