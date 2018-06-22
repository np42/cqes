import { Fx }                from './Fx';
import { InState, OutState } from './State';

export interface StateBus {
  restore(process: string): Promise<InState<any>>;
  save(process: string, versions: Map<string, any>, snapshot: OutState<any>): Promise<any>;
}
