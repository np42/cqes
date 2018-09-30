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
const Query_1 = require("./Query");
const AMQPBus_1 = require("./AMQPBus");
const AMQPQuery_1 = require("./AMQPQuery");
const uuid = require("uuid");
class AMQPQueryBus extends AMQPBus_1.AMQPBus {
    constructor(url) {
        super(url);
        this.id = '~Reply-' + uuid.v1();
        this.pending = new Map();
        this.queue = null;
        this.gcInterval = null;
    }
    gc() {
        const expired = [];
        const now = Date.now();
        for (const [key, item] of this.pending) {
            if (item.expiresAt > now)
                continue;
            expired.push(key);
        }
        for (const key of expired) {
            this.pending.get(key).reject(new Error('Timed out'));
            this.pending.delete(key);
        }
    }
    listenReply() {
        this.gcInterval = setInterval(() => this.gc(), 1000);
        this.queue = this.consume(this.id, (reply) => __awaiter(this, void 0, void 0, function* () {
            const session = this.pending.get(reply.id);
            if (session == null)
                return;
            session[reply.type](reply);
            this.pending.delete(reply.id);
        }), { noAck: true, channel: { prefetch: 100 }, queue: { exclusive: true }, Message: AMQPQuery_1.AMQPInReply });
    }
    serve(view, handler) {
        const options = { Message: AMQPQuery_1.AMQPInQuery,
            channel: { prefetech: 10 },
            reply: (channel) => (message) => (method, content) => __awaiter(this, void 0, void 0, function* () {
                const options = { correlationId: message.properties.correlationId };
                const reply = method == Query_1.ReplyType.Rejected ? new Query_1.OutReply(content) : new Query_1.OutReply(null, content);
                yield channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
                channel.ack(message);
            })
        };
        return this.consume('~Query-' + view, handler, options);
    }
    query(request, timeout = 30) {
        if (this.queue == null)
            this.listenReply();
        const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: false };
        const promise = new Promise((resolve, reject) => {
            const session = { expiresAt: Date.now() + (timeout * 1000), resolve, reject };
            options.expiration = String(timeout * 1000);
            this.pending.set(options.correlationId, session);
            this.publish(request.view, request.serialize(), options);
        });
        return promise;
    }
}
exports.AMQPQueryBus = AMQPQueryBus;
//# sourceMappingURL=AMQPQueryBus.js.map