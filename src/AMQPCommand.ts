import { Command } from './Command';

export class AMQPCommand extends Command {
  constructor(message, reply) {
    const payload = {};
    try { Object.assign(payload, JSON.parse(message.content.toString())) }
    catch (e) { /* Fail silently */ }
    super( payload.topicId || message.fields.routingKey
         , payload.orderType || 'Dummy'
         , payload.orderData || {}
         , payload.orderMeta || {}
         );
    this.createdAt = new Date(payload.createdAt);
    this.pulledAt  = new Date();
    Object.defineProperty(this, 'reply', { value: reply });
  }

  ack()    { this.reply('ack'); }
  nack()   { this.reply('nack'); }
  cancel() { this.reply('cancel'); }
}
