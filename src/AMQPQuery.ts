import { CommandReplier }  from './Command';
import { InQuery }         from './Query';
import { Status, InReply } from './Reply';
import { Message }         from 'amqplib';

export class AMQPInQuery extends InQuery {
  constructor(message: Message, reply: CommandReplier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , message.fields.routingKey
         , payload.method || 'Dummy'
         , payload.data   || {}
         , payload.meta   || {}
         );
    this.createdAt = new Date(payload.createdAt);
  }
}

export class AMQPInReply extends InReply {
  public id: string;
  constructor(message: Message) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    switch (payload.status) {
    case Status.Resolved: super(null, payload.data); break ;
    case Status.Rejected: super(payload.data); break ;
    }
    this.id = message.properties.correlationId;
  }
}
