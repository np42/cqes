import { Fx }                    from './Fx';
import { InEvent, OutEvent } from './Event';

export interface Subscription { stop: () => void };

export type FxSubscription      = Fx<any, Subscription>;
export type FxMessageHandler<T> = Fx<any, MessageHandler<T>>;

export type MessageHandler<T> = (message: T) => Promise<void>;
export type Handler<T>        = MessageHandler<T> | FxMessageHandler<T>;

export interface EventBus {
  subscribe(stream: string, position: any, handler: Handler<InEvent<any>>): FxSubscription;
  publish(stream: string, position: any, request: Array<OutEvent<any>>): Promise<any>;
}
