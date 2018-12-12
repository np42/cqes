"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("./Query");
class AMQPInQuery extends Query_1.InQuery {
    constructor(message, reply) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        super(reply, payload.view, payload.method || 'Dummy', payload.data || {}, payload.meta || {});
        this.createdAt = new Date(payload.createdAt);
    }
}
exports.AMQPInQuery = AMQPInQuery;
//# sourceMappingURL=AMQPQuery.js.map