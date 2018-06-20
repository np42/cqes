import { Query } from './Query';

export class AMQPQuery extends Query {
  constructor(message, reply) {
    const payload = {};
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

  resolve(content) { this.reply('resolve', content); }
  reject(error) { this.reply('reject', error); }
}
