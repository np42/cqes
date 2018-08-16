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
const Event_1 = require("./Event");
const ESEvent_1 = require("./ESEvent");
const ESCommand_1 = require("./ESCommand");
const ESState_1 = require("./ESState");
const ES = require("node-eventstore-client");
const URL = require("url");
const uuid = require("uuid");
class ESBus {
    constructor(url, settings = {}) {
        const address = URL.parse(url, true);
        const username = decodeURIComponent((address.auth || 'admin').split(':')[0]);
        const password = decodeURIComponent((address.auth || ':changeit').split(':')[1]);
        this.credentials = new ES.UserCredentials(username, password);
        this.connection = new Fx_1.Fx((_, fx) => {
            return new Promise((resolve, reject) => {
                const origin = address.protocol + '//' + address.host;
                const connection = ES.createConnection(settings, origin);
                connection.connect().catch(reject);
                connection.once('connected', endpoint => resolve(connection));
                connection.once('reconnecting', () => fx.failWith(new Error('Connection interrupted')));
                connection.once('closed', () => fx.failWith(new Error('Connection closed')));
                fx.on('disrupted', () => connection.close());
            });
        }, { name: 'ES.Connection' });
    }
    publish(stream, position, events) {
        const meta = {};
        const esEvents = events.map(event => {
            for (const key in event.meta)
                if (key.charAt(0) == '$')
                    meta[key] = event.meta[key];
            return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
        });
        return this.connection.try((connection, fx) => {
            return new Promise((resolve, reject) => {
                connection.appendToStream(stream, position, esEvents, this.credentials)
                    .then((result) => {
                    if (Object.keys(meta).length == 0)
                        return resolve(result);
                    return connection.setStreamMetadataRaw(stream, -2, meta, this.credentials)
                        .then(() => resolve(result))
                        .catch(e => fx.failWith(e));
                })
                    .catch(e => {
                    if (e.name == 'WrongExpectedVersionError')
                        return reject(e);
                    else
                        return fx.failWith(e);
                });
            });
        });
    }
    subscribe(stream, from, handler) {
        const state = { from };
        const fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.connection.pipe((connection, fx) => __awaiter(this, void 0, void 0, function* () {
            const hasPosition = state.from >= -1 && state.from != null;
            const fn = hasPosition ? 'subscribeToStreamFrom' : 'subscribeToStream';
            const args = [stream];
            if (hasPosition)
                args.push(state.from);
            args.push(true, (_, data) => {
                if (data.event == null) {
                    state.from = data.originalEventNumber.low;
                }
                else {
                    const event = new ESEvent_1.ESInEvent(data.event, data.originalEvent);
                    fxHandler.do((handler) => handler(event)).then(() => {
                        state.from = data.originalEventNumber.low;
                    });
                }
            });
            if (hasPosition)
                args.push(() => {
                    const event = new Event_1.InEvent(stream, '$liveReached');
                    fxHandler.do((handler) => handler(event));
                });
            args.push(() => {
                if (subscription._dropData.reason == 'userInitiated') {
                    fx.abort();
                }
                else {
                    subscription.stop();
                    fx.failWith(new Error('Connection lost'));
                }
            }, this.credentials);
            const subscription = connection[fn].apply(connection, args);
            return subscription;
        }), { name: 'ES.Subscriber.' + stream }).open();
    }
    consume(topic, handler) {
        const group = topic.substr(0, topic.indexOf(':'));
        const stream = topic.substr(group.length + 1);
        const fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.connection.pipe((connection, fx) => __awaiter(this, void 0, void 0, function* () {
            return connection.connectToPersistentSubscription(stream, group, (sub, data) => {
                if (data.event != null) {
                    const replier = (method) => sub[method](data);
                    const command = new ESCommand_1.ESInCommand(data.event, replier);
                    fxHandler.do((handler) => handler(command));
                }
                else {
                    sub.acknowledge(data);
                }
            }, (subscription) => {
                if (subscription._dropData.reason == 'userInitiated') {
                    fx.abort();
                }
                else {
                    subscription.stop();
                    fx.failWith(new Error('Connection lost'));
                }
            }, this.credentials, 1, false);
        }), { name: 'ES.Consumer.' + topic }).open();
    }
    restore(StateDataClass, process) {
        if (process == null)
            process = StateDataClass.name;
        return new Promise(resolve => {
            return this.last(process, 1, event => new ESState_1.ESInState(StateDataClass, event)).then(result => {
                if (result.length == 0)
                    return resolve(null);
                else
                    return resolve(result[0]);
            });
        });
    }
    save(state) {
        const process = state.process;
        const event = new ESState_1.ESOutState(state);
        return this.publish(process, -2, [event]);
    }
    last(stream, count, wrapper) {
        return this.connection.do((connection) => __awaiter(this, void 0, void 0, function* () {
            if (wrapper == null)
                wrapper = event => new ESEvent_1.ESInEvent(event);
            return (yield connection.readStreamEventsBackward(stream, -1, count, true, this.credentials))
                .events.map(data => wrapper(data.event)).reverse();
        }));
    }
    tweak(stream, version, metadata) {
        return this.connection.try((connection, fx) => {
            return new Promise((resolve, reject) => {
                connection.setStreamMetadataRaw(stream, version, metadata, this.credentials)
                    .then(resolve)
                    .catch(e => {
                    if (e.name == 'WrongExpectedVersionError')
                        return reject(e);
                    else
                        return fx.failWith(e);
                });
            });
        });
    }
}
exports.ESBus = ESBus;
//# sourceMappingURL=ESBus.js.map