import { Fx }                    from './Fx';
import { InCommand, OutCommand } from './Command';

export interface Subscription { stop: () => void };

export type FxSubscription      = Fx<any, Subscription>;
export type FxMessageHandler<T> = Fx<any, MessageHandler<T>>;

export type MessageHandler<T> = (message: T) => Promise<void>;
export type Handler<T>        = MessageHandler<T> | FxMessageHandler<T>;

export interface CommandBus {
  listen(topic: string, handler: Handler<InCommand<any>>): FxSubscription;
  command(request: OutCommand<any>): Promise<any>;
}
