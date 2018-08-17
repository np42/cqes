import { State, StateData }    from './State';
import { OutEvent, EventData } from './Event';
import * as ES                 from 'node-eventstore-client';

export class ESInState<D extends StateData> extends State<D> {

  constructor(StateDataClass: new (_: any) => D, message: ES.RecordedEvent) {
    const payload = { data: <any>null, position: -1 };
    try { Object.assign(payload, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const data = payload.data;
    super(StateDataClass, data, payload.position);
  }

}

export class ESOutState<D extends StateData> extends OutEvent<Snapshoted> {

  constructor(state: State<D>) {
    super(state.process, new Snapshoted(state));
  }

}

class Snapshoted extends EventData {
  public position:  number;
  public timestamp: number;
  public data:      any;
  constructor(data: any) {
    super();
    this.position  = data.position;
    this.timestamp = Date.now();
    this.data      = data.data;
  }
}
