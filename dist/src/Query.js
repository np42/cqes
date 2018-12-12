"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Reply_1 = require("./Reply");
class Query {
    constructor(view, method, data, meta) {
        this.view = view;
        this.createdAt = new Date();
        this.method = method || view;
        this.data = data;
        this.meta = meta || null;
    }
}
exports.Query = Query;
class InQuery extends Query {
    constructor(reply, view, method, data, meta) {
        super(view, method, data, meta);
        this.pulledAt = new Date();
        Object.defineProperty(this, 'reply', { value: reply });
    }
    resolve(content) { this.reply(Reply_1.Status.Resolved, content); }
    reject(content) { this.reply(Reply_1.Status.Rejected, content); }
}
exports.InQuery = InQuery;
class OutQuery extends Query {
    serialize() {
        return Buffer.from(JSON.stringify(this));
    }
}
exports.OutQuery = OutQuery;
//# sourceMappingURL=Query.js.map