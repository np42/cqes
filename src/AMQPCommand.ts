import { InCommand, CommandReplier } from './Command';
import { Message }                   from 'amqplib';

export class AMQPInCommand<D> extends InCommand<D> {
  constructor(message: Message, reply: CommandReplier) {
    const payload = { topic: <string>null, type: <string>null, createdAt: <number>null
                    , data: <D>null, meta: <Object>null
                    };
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , payload.topic || message.fields.routingKey
         , payload.type  || 'Dummy'
         , <D>payload.data
         , payload.meta
         );
    this.createdAt = new Date(payload.createdAt);
  }
}
