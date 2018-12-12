"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class AMQPInCommand extends Command_1.InCommand {
    constructor(message, reply) {
        const payload = new Command_1.Command(null, null);
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(reply, payload.key || message.fields.routingKey, payload.order || 'Dummy', payload.data, payload.meta);
        this.createdAt = new Date(payload.createdAt);
    }
    cancel(reason) { this.reply('reject', reason); }
}
exports.AMQPInCommand = AMQPInCommand;
//# sourceMappingURL=AMQPCommand.js.map