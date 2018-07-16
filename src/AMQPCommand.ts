import { InCommand, CommandReplier, CommandData } from './Command';
import { Message }                                from 'amqplib';

export class AMQPInCommand<D extends CommandData> extends InCommand<D> {
  constructor(message: Message, reply: CommandReplier) {
    const payload = { topic: <string>null, name: <string>null, createdAt: <number>null
                    , data: <D>null, meta: <Object>null
                    };
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , payload.topic || message.fields.routingKey
         , payload.name  || 'Dummy'
         , <D>payload.data
         , payload.meta
         );
    this.createdAt = new Date(payload.createdAt);
  }
  cancel(reason?: any) { this.reply('reject', reason); }
}
