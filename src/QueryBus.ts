import { Fx }                      from './Fx';
import { Handler, FxSubscription } from './CommandBus';
import { InQuery, OutQuery }       from './Query';

export interface QueryBus {
  serve(view: string, handler: Handler<InQuery<any>>): FxSubscription;
  query(request: OutQuery<any>, timeout?: number): Promise<any>;
}
