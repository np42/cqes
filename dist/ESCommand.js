"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class ESInCommand extends Command_1.InCommand {
    constructor(message, reply) {
        const data = {};
        try {
            Object.assign(data, JSON.parse(message.data.toString()));
        }
        catch (e) { }
        const meta = {};
        try {
            Object.assign(meta, JSON.parse(message.metadata.toString() || null));
        }
        catch (e) { }
        super(reply, message.eventStreamId, message.eventType, data, meta);
        this.createdAt = new Date(message.createdEpoch);
    }
    ack() { this.reply('acknowledge'); }
    cancel() { this.reply('fail'); }
}
exports.ESInCommand = ESInCommand;
//# sourceMappingURL=ESCommand.js.map