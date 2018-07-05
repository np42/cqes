"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Command {
    constructor(topic, name, data, meta) {
        this.topic = topic;
        this.createdAt = new Date();
        this.name = name;
        this.data = data;
        this.meta = meta;
    }
}
class InCommand extends Command {
    constructor(reply, topic, name, data, meta) {
        super(topic, name, data, meta);
        this.pulledAt = new Date();
        Object.defineProperty(this, 'reply', { value: reply });
    }
    ack() { this.reply('ack'); }
    nack(reason) { this.reply('nack', reason); }
    cancel(reason) { this.reply('cancel', reason); }
}
exports.InCommand = InCommand;
class OutCommand extends Command {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutCommand = OutCommand;
//# sourceMappingURL=Command.js.map