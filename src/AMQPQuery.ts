import { CommandReplier }              from './Command';
import { InQuery, ReplyType, InReply } from './Query';
import { Message }                     from 'amqplib';

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
    switch (payload.type) {
    case ReplyType.Resolved: super(null, payload.data); break ;
    case ReplyType.Rejected: super(payload.error); break ;
    }
    this.id = message.properties.correlationId;
  }
}
