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
        super(reply, message.fields.routingKey, payload.method || 'Dummy', payload.data || {}, payload.meta || {});
        this.createdAt = new Date(payload.createdAt);
    }
}
exports.AMQPInQuery = AMQPInQuery;
class AMQPInReply extends Query_1.InReply {
    constructor(message, reply) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        switch (payload.type) {
            case Query_1.ReplyType.Resolved:
                super(reply, null, payload.data);
                break;
            case Query_1.ReplyType.Rejected:
                super(reply, payload.error);
                break;
        }
    }
}
exports.AMQPInReply = AMQPInReply;
//# sourceMappingURL=AMQPQuery.js.map