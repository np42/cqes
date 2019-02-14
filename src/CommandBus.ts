import { Fx }                    from './Fx';
import { InCommand, OutCommand } from './Command';
import { Reply }                 from './Reply';

export interface Subscription { stop: () => void };

export type FxSubscription      = Fx<any, Subscription>;
export type FxMessageHandler<T> = Fx<any, MessageHandler<T>>;

export type MessageHandler<T> = (message: T) => Promise<void>;
export type Handler<T>        = MessageHandler<T> | FxMessageHandler<T>;

export interface CommandBus {
  start(): Promise<boolean>;
  stop():  Promise<void>;
  listen(topic: string, handler: Handler<InCommand>, options?: any): void;
  request(request: OutCommand): Promise<Reply>;
}
