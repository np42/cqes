import { Reply }   from './Reply';
import { Message } from 'amqplib';

type Replier = (action: string) => void;

export class AMQPReply extends Reply {
  public id: string;
  private reply: Replier;

  constructor(message: Message, reply: Replier) {
    const payload = <any>{};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super(payload.type, payload.value);
    this.id = message.properties.correlationId;
    Object.defineProperty(this, 'reply', { value: reply });
  }

  ack()    { this.reply('ack'); }
  nack()   { this.reply('nack'); }
  cancel() { this.reply('cancel'); }
}
