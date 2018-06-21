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
const Fx_1 = require("./Fx");
const AMQPCommand_1 = require("./AMQPCommand");
const amqp = require("amqplib");
class AMQPBus {
    constructor(url) {
        this.connection =
            new Fx_1.Fx((_, fx) => amqp.connect(url))
                .then((connection, fx) => __awaiter(this, void 0, void 0, function* () {
                connection.on('close', () => fx.snap(new Error('Connection close')));
                return connection;
            }))
                .open();
        this.channels = new Map();
    }
    getChannel(queue, options) {
        const channel = this.channels.get(queue);
        if (channel != null)
            return channel;
        this.channels.set(queue, this.connection.pipe((connection) => __awaiter(this, void 0, void 0, function* () {
            const channel = yield connection.createConfirmChannel();
            yield channel.assertQueue(queue, options);
            return channel;
        })));
        return this.channels.get(queue);
    }
    consume(queue, handler, options) {
        if (options == null)
            options = {};
        if (options.noAck == null)
            options.noAck = false;
        if (options.Message == null)
            options.Message = AMQPCommand_1.AMQPCommand;
        if (options.reply == null)
            options.reply = (channel) => (message) => (method) => channel[method](message);
        if (options.channel == null)
            options.channel = {};
        if (!(options.channel.prefetch > 0))
            options.channel.prefetch = 1;
        if (options.queue == null)
            options.queue = {};
        if (options.queue.durable == null)
            options.queue.durable = true;
        const fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.getChannel(queue, options.queue).pipe((channel) => __awaiter(this, void 0, void 0, function* () {
            yield channel.prefetch(options.channel.prefetch, false);
            const replier = options.reply(channel);
            return channel.consume(queue, rawMessage => {
                const message = new options.Message(rawMessage, replier(rawMessage));
                fxHandler.do((handler) => __awaiter(this, void 0, void 0, function* () { return handler(message); }));
            }, options);
        }));
    }
    publish(queue, message, options) {
        if (options == null)
            options = {};
        if (options.queue == null)
            options.queue = queue;
        if (options.channel == null)
            options.channel = {};
        return this.getChannel(options.queue, options.channel).do((channel) => __awaiter(this, void 0, void 0, function* () {
            return channel.sendToQueue(queue, message, options);
        }));
    }
}
exports.AMQPBus = AMQPBus;
//# sourceMappingURL=AMQPBus.js.map