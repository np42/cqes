import { State, StateData } from './State';
export interface StateBus {
    restore<D extends StateData>(StateDataClass: new (_: any) => D, process?: string): Promise<State<D>>;
    save<D extends StateData>(state: State<D>): Promise<any>;
}
