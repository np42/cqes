import { CommandReplier }  from './Command';
import { InQuery }         from './Query';
import { Message }         from 'amqplib';

export class AMQPInQuery extends InQuery {

  constructor(message: Message, reply: CommandReplier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , payload.view   // Source of bug ?! message.fields.routingKey
         , payload.method || 'Dummy'
         , payload.data   || {}
         , payload.meta   || {}
         );
    this.createdAt = new Date(payload.createdAt);
  }

}
