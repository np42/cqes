"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Query {
    constructor(view, method, data, meta) {
        this.view = view;
        this.createdAt = new Date();
        this.method = method;
        this.data = data;
        this.meta = meta;
    }
}
class InQuery extends Query {
    constructor(reply, view, method, data, meta) {
        super(view, method, data, meta);
        this.pulledAt = new Date();
        Object.defineProperty(this, 'reply', { value: reply });
    }
    resolve(content) { this.reply(ReplyType.Resolved, content); }
    reject(error) { this.reply(ReplyType.Rejected, error); }
}
exports.InQuery = InQuery;
class OutQuery extends Query {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutQuery = OutQuery;
var ReplyType;
(function (ReplyType) {
    ReplyType["Resolved"] = "resolve";
    ReplyType["Rejected"] = "reject";
})(ReplyType = exports.ReplyType || (exports.ReplyType = {}));
class Reply {
    constructor(error, data) {
        this.type = error != null ? ReplyType.Rejected : ReplyType.Resolved;
        this.error = error;
        this.data = data;
    }
}
class InReply extends Reply {
    constructor(reply, error, data) {
        super(error, data);
        this.pulledAt = new Date();
        Object.defineProperty(this, 'reply', { value: reply });
    }
    ack() { this.reply('ack'); }
    nack() { this.reply('nack'); }
    cancel() { this.reply('cancel'); }
}
exports.InReply = InReply;
class OutReply extends Reply {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutReply = OutReply;
//# sourceMappingURL=Query.js.map