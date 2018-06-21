import { InCommand, CommandReplier } from './Command';
import { Message }                   from 'amqplib';

export class AMQPInCommand<D> extends InCommand<D> {
  constructor(message: Message, reply: CommandReplier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( payload.topic || message.fields.routingKey
         , payload.type  || 'Dummy'
         , payload.data  || {}
         , payload.meta  || {}
         );
    this.createdAt = new Date(payload.createdAt);
  }
}
