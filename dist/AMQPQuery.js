"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("./Query");
class AMQPQuery extends Query_1.Query {
    constructor(message, reply) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(message.fields.routingKey, payload.method || 'Dummy', payload.data || {}, payload.meta || {});
        this.createdAt = new Date(payload.createdAt);
        Object.defineProperty(this, 'reply', { value: reply });
    }
    resolve(content) { this.reply('resolve', content); }
    reject(error) { this.reply('reject', error); }
}
exports.AMQPQuery = AMQPQuery;
//# sourceMappingURL=AMQPQuery.js.map