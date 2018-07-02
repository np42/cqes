import { InState, OutState }  from './State';
import { OutEvent }           from './Event';
import * as ES                from 'node-eventstore-client';

export class ESInState<D> extends InState<D> {

  constructor(message: ES.RecordedEvent) {
    const payload = { data: <D>null, position: -1 };
    try { Object.assign(payload, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const meta = {};
    try { Object.assign(meta, JSON.parse(message.metadata.toString() || null)) }
    catch (e) { /* Fail silently */ }
    const data = payload.data;
    super(message.eventStreamId, payload.position, data, meta);
    this.createdAt = new Date(message.createdEpoch);
  }

}

export class ESOutState<D> extends OutEvent<{ position: any, data: D }> {

  constructor(state: OutState<D>) {
    const payload = { position: state.position, data: state.data };
    super(state.process, 'Snapshot', payload, state.meta);
  }

}
