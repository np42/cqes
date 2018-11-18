import { Handler as CommandHandler, FxSubscription } from './CommandBus';
import { InQuery, OutQuery }                         from './Query';

export type Handler<T> = CommandHandler<T>;

export interface QueryBus {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  serve(view: string, handler: Handler<InQuery>): void;
  query(request: OutQuery, timeout?: number): Promise<any>;
}
