"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class AMQPCommand extends Command_1.Command {
    constructor(message, reply) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(payload.topic || message.fields.routingKey, payload.type || 'Dummy', payload.data || {}, payload.meta || {});
        this.createdAt = new Date(payload.createdAt);
        this.pulledAt = new Date();
        Object.defineProperty(this, 'reply', { value: reply });
    }
    ack() { this.reply('ack'); }
    nack() { this.reply('nack'); }
    cancel() { this.reply('cancel'); }
}
exports.AMQPCommand = AMQPCommand;
//# sourceMappingURL=AMQPCommand.js.map