import { Reply } from './Reply';

export class AMQPReply extends Reply {
  constructor(message, reply) {
    const payload = {};
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
