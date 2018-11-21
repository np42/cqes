import { Status, InReply } from './Reply';
import { Message }         from 'amqplib';

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
