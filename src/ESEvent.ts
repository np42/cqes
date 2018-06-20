import { Event } from './Event';

export class ESEvent extends Event {
  constructor(message) {
    const data = {};
    try { Object.assign(data, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const meta = {};
    try { Object.assign(meta, JSON.parse(message.metadata.toString() || null)) }
    catch (e) { /* Fail silently */ }
    super(message.eventStreamId, message.eventType, data, meta);
    this.createdAt = new Date(message.created);
    this.eventNumber = message.eventNumber.low;
  }
}
