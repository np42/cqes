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
const ES = require("node-eventstore-client");
const URL = require("url");
const uuid = require("uuid");
class ESEventBus {
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
                connection.once('closed', () => fx.snap(new Error('Connection closed')));
            });
        }).open();
    }
    subscribe(stream, from, handler) {
        const state = { from };
        const fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.connection.pipe((connection, fx) => __awaiter(this, void 0, void 0, function* () {
            const subscription = connection.subscribeToStreamFrom(stream, state.from, true, (_, data) => {
                const event = new ESEvent_1.ESInEvent(data.event);
                fxHandler.do((handler) => handler(event)).then(() => {
                    state.from = event.number;
                });
            }, () => {
                const event = new Event_1.InEvent(stream, '$liveReached');
                fxHandler.do((handler) => handler(event));
            }, () => {
                if (subscription._dropData.reason == 'userInitiated') {
                    fx.close();
                }
                else {
                    subscription.stop();
                    fx.snap(new Error('Connection lost'));
                }
            }, this.credentials);
            return subscription;
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
                        return fx.snap(e);
                });
            });
        });
    }
    publish(stream, position, events) {
        const esEvents = events.map(event => {
            return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
        });
        return this.connection.try((connection, fx) => {
            return new Promise((resolve, reject) => {
                connection.appendToStream(stream, position, esEvents, this.credentials)
                    .then(resolve)
                    .catch(e => {
                    if (e.name == 'WrongExpectedVersionError')
                        return reject(e);
                    else
                        return fx.snap(e);
                });
            });
        });
    }
    last(stream, count) {
        return this.connection.do((connection) => __awaiter(this, void 0, void 0, function* () {
            return (yield connection.readStreamEventsBackward(stream, -1, count, true, this.credentials))
                .events.map(data => new ESEvent_1.ESInEvent(data.event));
        }));
    }
}
exports.ESEventBus = ESEventBus;
//# sourceMappingURL=ESEventBus.js.map