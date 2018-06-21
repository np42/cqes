import { Query }   from './Query';
import { Message } from 'amqplib';

type Replier = (action: string, value: any) => void;
type Error = string;

export class AMQPQuery extends Query {
  private reply: Replier;

  constructor(message: Message, reply: Replier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( message.fields.routingKey
         , payload.method || 'Dummy'
         , payload.data || {}
         , payload.meta || {}
         );
    this.createdAt = new Date(payload.createdAt);
    Object.defineProperty(this, 'reply', { value: reply });
  }

  resolve(content: any) { this.reply('resolve', content); }
  reject(error: Error) { this.reply('reject', error); }
}
