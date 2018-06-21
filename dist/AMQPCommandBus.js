"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AMQPBus_1 = require("./AMQPBus");
class AMQPCommandBus extends AMQPBus_1.AMQPBus {
    constructor(url) {
        super(url);
    }
    listen(topic, handler) {
        const options = { channel: { prefetch: 10 } };
        return this.consume(topic, handler, options);
    }
    command(request) {
        const options = { persistent: true };
        return this.publish(request.topic, request.serialize(), options);
    }
}
exports.AMQPCommandBus = AMQPCommandBus;
//# sourceMappingURL=AMQPCommandBus.js.map