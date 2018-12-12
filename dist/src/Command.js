"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Reply_1 = require("./Reply");
class Command {
    constructor(key, order, data, meta) {
        this.key = key;
        this.order = order;
        this.createdAt = new Date();
        this.data = data instanceof Object ? data : {};
        this.meta = meta instanceof Object ? meta : {};
    }
    get id() {
        const offset = this.key.indexOf('-');
        return offset > 0 ? this.key.substr(offset + 1) : this.key;
    }
}
exports.Command = Command;
class InCommand extends Command {
    constructor(reply, key, order, data, meta) {
        super(key, order, data, meta);
        this.pulledAt = new Date();
        if (reply == null)
            reply = (action, reason) => void (0);
        Object.defineProperty(this, 'reply', { value: reply });
    }
    resolve(content) { this.reply(Reply_1.Status.Resolved, content); }
    reject(content) { this.reply(Reply_1.Status.Rejected, content); }
    cancel(reason) { this.reply('cancel', reason); }
}
exports.InCommand = InCommand;
class OutCommand extends Command {
    constructor(key, order, data, meta) {
        super(key, order, data, meta);
    }
    serialize() {
        return Buffer.from(JSON.stringify(this));
    }
}
exports.OutCommand = OutCommand;
//# sourceMappingURL=Command.js.map