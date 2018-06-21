import { Event } from './Event';
import * as ES   from 'node-eventstore-client';

export class ESEvent<D> extends Event<D> {

  constructor(message: ES.RecordedEvent) {
    const data = {};
    try { Object.assign(data, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const meta = {};
    try { Object.assign(meta, JSON.parse(message.metadata.toString() || null)) }
    catch (e) { /* Fail silently */ }
    super(message.eventStreamId, message.eventType, <any>data, meta);
    this.createdAt = new Date(message.createdEpoch);
    this.number = message.eventNumber.low;
  }
}
