import { Handler as CommandHandler, FxSubscription } from './CommandBus';
import { InQuery, OutQuery }                         from './Query';

export type Handler<T> = CommandHandler<T>;

export interface QueryBus {
  serve(view: string, handler: Handler<InQuery<any>>): FxSubscription;
  query(request: OutQuery<any>, timeout?: number): Promise<any>;
}
