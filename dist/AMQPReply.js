"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Reply_1 = require("./Reply");
class AMQPReply extends Reply_1.Reply {
    constructor(message, reply) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(payload.type, payload.value);
        this.id = message.properties.correlationId;
        Object.defineProperty(this, 'reply', { value: reply });
    }
    ack() { this.reply('ack'); }
    nack() { this.reply('nack'); }
    cancel() { this.reply('cancel'); }
}
exports.AMQPReply = AMQPReply;
//# sourceMappingURL=AMQPReply.js.map