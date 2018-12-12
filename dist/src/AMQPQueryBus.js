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
const Reply_1 = require("./Reply");
const AMQPReply_1 = require("./AMQPReply");
const uuid = require("uuid");
;
;
class AMQPQueryBus extends AMQPBus_1.AMQPBus {
    constructor(config) {
        super(config);
        this.id = config.name + '.Reply.' + uuid.v1();
        this.pending = new Map();
        this.response = null;
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
            this.pending.get(key).resolve(new Reply_1.Reply('Timed out'));
            this.pending.delete(key);
        }
    }
    start() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            _super("start").call(this);
            this.gcInterval = setInterval(() => this.gc(), 1000);
            this.response = (yield this.consume(this.id, (reply) => __awaiter(this, void 0, void 0, function* () {
                const session = this.pending.get(reply.id);
                if (session == null)
                    return;
                session.resolve(reply);
                this.pending.delete(reply.id);
            }), { noAck: true,
                channel: { prefetch: 100 },
                queue: { exclusive: true, durable: false },
                Message: AMQPReply_1.AMQPInReply
            }));
            return true;
        });
    }
    serve(view, handler) {
        const options = { Message: AMQPQuery_1.AMQPInQuery,
            channel: { prefetch: 10 },
            reply: (channel) => (message) => (method, content) => {
                const options = { correlationId: message.properties.correlationId };
                const reply = method == Reply_1.Status.Rejected ? new Reply_1.OutReply(content) : new Reply_1.OutReply(null, content);
                channel.sendToQueue(message.properties.replyTo, reply.serialize(), options);
                channel.ack(message);
            }
        };
        return this.consume(view + '.Query', handler, options);
    }
    query(request, timeout = 30) {
        const options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: false };
        const offset = request.view.indexOf('-');
        const topic = offset > 0 ? request.view.substr(0, offset) : request.view;
        const promise = new Promise(resolve => {
            const session = { expiresAt: Date.now() + (timeout * 1000), resolve };
            options.expiration = String(timeout * 1000);
            this.pending.set(options.correlationId, session);
            this.publish(topic + '.Query', request.serialize(), options);
        });
        return promise;
    }
}
exports.AMQPQueryBus = AMQPQueryBus;
//# sourceMappingURL=AMQPQueryBus.js.map