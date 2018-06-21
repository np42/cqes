import { Command } from './Command';
import { Message } from 'amqplib';

type Replier = (action: string) => void;

export class AMQPCommand<D> extends Command<D> {
  public  pulledAt: Date;
  private reply:    Replier;

  constructor(message: Message, reply: Replier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( payload.topic || message.fields.routingKey
         , payload.type  || 'Dummy'
         , payload.data  || {}
         , payload.meta  || {}
         );
    this.createdAt = new Date(payload.createdAt);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }

  ack()    { this.reply('ack'); }
  nack()   { this.reply('nack'); }
  cancel() { this.reply('cancel'); }
}
