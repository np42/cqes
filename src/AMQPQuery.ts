import { CommandReplier }                        from './Command';
import { InQuery, ReplyType, InReply, OutReply } from './Query';
import { Message }                               from 'amqplib';

export class AMQPInQuery<D> extends InQuery<D> {
  constructor(message: Message, reply: CommandReplier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( reply
         , message.fields.routingKey
         , payload.method || 'Dummy'
         , payload.data || {}
         , payload.meta || {}
         );
    this.createdAt = new Date(payload.createdAt);
  }
}

export class AMQPInReply<D> extends InReply<D> {
  constructor(message: Message, reply: CommandReplier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    switch (payload.type) {
    case ReplyType.Resolved: super(reply, null, payload.data); break ;
    case ReplyType.Rejected: super(reply, payload.error); break ;
    }
  }
}
