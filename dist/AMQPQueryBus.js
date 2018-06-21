"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const AMQPBus_1 = require("./AMQPBus");
const AMQPQuery_1 = require("./AMQPQuery");
const AMQPReply_1 = require("./AMQPReply");
const Reply_1 = require("./Reply");
const uuid = require("uuid");
class AMQPQueryBus extends AMQPBus_1.AMQPBus {
    constructor(url) {
        super(url);
        this.id = 'RPC-' + uuid.v1();
        this.pending = new Map();
        this.queue = this.consume(this.id, (reply) => __awaiter(this, void 0, void 0, function* () {
            const session = this.pending.get(reply.id);
            if (session == null)
                return;
            session[reply.type](reply);
            this.pending.delete(reply.id);
        }), { channel: { prefetch: 100 }, queue: { exclusive: true }, Message: AMQPReply_1.AMQPReply });
        this.gcInterval = setInterval(() => this.gc(), 1000);
    }
    gc() {
        const expired = [];
        const now = Date.now();
        for (const [key, item] of this.pending) {
            if (item.expiresAt > now)
                continue;
            expired.push(key);
        }
        for (const key of expired)
            this.pending.delete(key);
    }
    serve(view, handler) {
        const options = { Message: AMQPQuery_1.AMQPQuery,
            channel: { prefetech: 10 },
            reply: (channel) => (message) => (method, content) => __awaiter(this, void 0, void 0, function* () {
                const options = { correlationId: message.properties.correlationId };
                const reply = new Reply_1.Reply(method, content).serialize();
                yield channel.sendToQueue(message.properties.replyTo, reply, options);
                channel.ack(message);
            })
        };
        return this.consume(view, handler, options);
    }
    query(request, timeout = 30) {
        const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4() };
        const promise = new Promise((resolve, reject) => {
            const session = { expiresAt: Date.now() + (timeout * 1000), resolve, reject };
            this.pending.set(options.correlationId, session);
            this.publish(request.view, request.serialize(), options);
        });
        return promise;
    }
}
exports.AMQPQueryBus = AMQPQueryBus;
//# sourceMappingURL=AMQPQueryBus.js.map