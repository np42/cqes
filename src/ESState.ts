import { InState, OutState }  from './State';
import { OutEvent }           from './Event';
import * as ES                from 'node-eventstore-client';

export class ESInState<D> extends InState<D> {

  constructor(message: ES.RecordedEvent) {
    const payload = { data: <D>null, versions: <Object>null };
    try { Object.assign(payload, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const meta = {};
    try { Object.assign(meta, JSON.parse(message.metadata.toString() || null)) }
    catch (e) { /* Fail silently */ }
    const versions = new Map();
    for (const key in payload.versions) versions.set(key, payload.versions[key]);
    const data = payload.data;
    super(message.eventStreamId, versions, data, meta);
    this.createdAt = new Date(message.createdEpoch);
  }

}

export class ESOutState<D> extends OutEvent<{ versions: Object, data: D }> {

  constructor(state: OutState<D>) {
    const payload = { versions: {}, data: state.data };
    for (const [key, value] of state.versions) payload.versions[key] = value;
    super(state.process, 'Snapshot', payload, state.meta);
  }

}
