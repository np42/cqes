"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class AMQPInCommand extends Command_1.InCommand {
    constructor(message, reply) {
        const payload = { topic: null, name: null, createdAt: null,
            data: null, meta: null
        };
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(reply, payload.topic || message.fields.routingKey, payload.name || 'Dummy', payload.data, payload.meta);
        this.createdAt = new Date(payload.createdAt);
    }
}
exports.AMQPInCommand = AMQPInCommand;
//# sourceMappingURL=AMQPCommand.js.map