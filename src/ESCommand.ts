import { InCommand, CommandReplier, CommandData } from './Command';
import * as ES                                    from 'node-eventstore-client';

export class ESInCommand<D extends CommandData> extends InCommand<D> {
  public number: number;

  constructor(message: ES.RecordedEvent, reply: CommandReplier) {
    const data = {};
    try { Object.assign(data, JSON.parse(message.data.toString())) }
    catch (e) { /* Fail silently */ }
    const meta = {};
    try { Object.assign(meta, JSON.parse(message.metadata.toString() || null)) }
    catch (e) { /* Fail silently */ }
    super(reply, message.eventStreamId, message.eventType, <D>data, meta);
    this.createdAt = new Date(message.createdEpoch);
    this.number = message.eventNumber.low;
  }

  ack() { this.reply('acknowledge'); }
  cancel() { this.reply('fail'); }

}
