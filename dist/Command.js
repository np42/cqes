"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Command {
    constructor(topic, name, data, meta) {
        this.topic = topic;
        this.createdAt = new Date();
        this.name = name;
        if (!(data instanceof Object))
            data = {};
        this.data = data;
        if (!(meta instanceof Object))
            meta = {};
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
    cancel(reason) { this.reply('cancel', reason); }
}
exports.InCommand = InCommand;
class OutCommand extends Command {
    constructor(topic, instance, meta) {
        super(topic, instance.constructor.name, instance, meta);
    }
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutCommand = OutCommand;
class CommandData {
}
exports.CommandData = CommandData;
//# sourceMappingURL=Command.js.map