"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Reply_1 = require("./Reply");
class AMQPInReply extends Reply_1.InReply {
    constructor(message) {
        const payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { }
        switch (payload.status) {
            case Reply_1.Status.Resolved:
                super(null, payload.data);
                break;
            case Reply_1.Status.Rejected:
                super(payload.data);
                break;
        }
        this.id = message.properties.correlationId;
    }
}
exports.AMQPInReply = AMQPInReply;
//# sourceMappingURL=AMQPReply.js.map