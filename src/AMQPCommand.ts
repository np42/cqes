import { Command, InCommand, CommandReplier } from './Command';
import { Message }                            from 'amqplib';

export class AMQPInCommand extends InCommand {

  constructor(message: Message, reply: CommandReplier) {
    const payload = new Command(null, null);
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , payload.key   || message.fields.routingKey
         , payload.order || 'Dummy'
         , payload.data
         , payload.meta
         );
    this.createdAt = new Date(payload.createdAt);
  }

}


