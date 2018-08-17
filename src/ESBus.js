"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var Fx_1 = require("./Fx");
var Event_1 = require("./Event");
var ESEvent_1 = require("./ESEvent");
var ESCommand_1 = require("./ESCommand");
var ESState_1 = require("./ESState");
var ES = require("node-eventstore-client");
var URL = require("url");
var uuid = require("uuid");
var ESBus = /** @class */ (function () {
    function ESBus(url, settings) {
        if (settings === void 0) { settings = {}; }
        var address = URL.parse(url, true);
        var username = decodeURIComponent((address.auth || 'admin').split(':')[0]);
        var password = decodeURIComponent((address.auth || ':changeit').split(':')[1]);
        this.credentials = new ES.UserCredentials(username, password);
        this.connection = new Fx_1.Fx(function (_, fx) {
            return new Promise(function (resolve, reject) {
                var origin = address.protocol + '//' + address.host;
                var connection = ES.createConnection(settings, origin);
                connection.connect()["catch"](reject);
                connection.once('connected', function (endpoint) { return resolve(connection); });
                connection.once('reconnecting', function () { return fx.failWith(new Error('Connection interrupted')); });
                connection.once('closed', function () { return fx.failWith(new Error('Connection closed')); });
                fx.on('disrupted', function () { return connection.close(); });
            });
        }, { name: 'ES.Connection' });
    }
    //-- Event
    ESBus.prototype.publish = function (stream, position, events) {
        var _this = this;
        var meta = {};
        var esEvents = events.map(function (event) {
            for (var key in event.meta)
                if (key.charAt(0) == '$')
                    meta[key] = event.meta[key];
            return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
        });
        return this.connection["try"](function (connection, fx) {
            return new Promise(function (resolve, reject) {
                connection.appendToStream(stream, position, esEvents, _this.credentials)
                    .then(function (result) {
                    if (Object.keys(meta).length == 0)
                        return resolve(result);
                    return connection.setStreamMetadataRaw(stream, -2, meta, _this.credentials)
                        .then(function () { return resolve(result); })["catch"](function (e) { return fx.failWith(e); });
                })["catch"](function (e) {
                    if (e.name == 'WrongExpectedVersionError')
                        return reject(e);
                    else
                        return fx.failWith(e);
                });
            });
        });
    };
    ESBus.prototype.subscribe = function (stream, from, handler) {
        var _this = this;
        var state = { from: from };
        var fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.connection.pipe(function (connection, fx) { return __awaiter(_this, void 0, void 0, function () {
            var hasPosition, fn, args, subscription;
            return __generator(this, function (_a) {
                hasPosition = state.from >= -1 && state.from != null;
                fn = hasPosition ? 'subscribeToStreamFrom' : 'subscribeToStream';
                args = [stream];
                if (hasPosition)
                    args.push(state.from);
                args.push(/* resolveLinkTos */ true, /* eventAppeared */ function (_, data) {
                    if (data.event == null) {
                        // When event deleted
                        state.from = data.originalEventNumber.low;
                    }
                    else {
                        // When normal event
                        var event_1 = new ESEvent_1.ESInEvent(data.event, data.originalEvent);
                        fxHandler["do"](function (handler) { return handler(event_1); }).then(function () {
                            state.from = data.originalEventNumber.low;
                        });
                    }
                });
                if (hasPosition)
                    args.push(/* liveProcessingStarted */ function () {
                        var event = new Event_1.InEvent(stream, '$liveReached');
                        fxHandler["do"](function (handler) { return handler(event); });
                    });
                args.push(/* subscriptionDropped */ function () {
                    if (subscription._dropData.reason == 'userInitiated') {
                        fx.abort();
                    }
                    else {
                        subscription.stop();
                        fx.failWith(new Error('Connection lost'));
                    }
                }, this.credentials);
                subscription = connection[fn].apply(connection, args);
                return [2 /*return*/, subscription];
            });
        }); }, { name: 'ES.Subscriber.' + stream }).open();
    };
    ESBus.prototype.consume = function (topic, handler) {
        var _this = this;
        var group = topic.substr(0, topic.indexOf(':'));
        var stream = topic.substr(group.length + 1);
        var fxHandler = (handler instanceof Fx_1.Fx ? handler : Fx_1.Fx.create(handler)).open();
        return this.connection.pipe(function (connection, fx) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, connection.connectToPersistentSubscription(stream, group, function (sub, data) {
                        if (data.event != null) {
                            var replier = function (method) { return sub[method](data); };
                            var command_1 = new ESCommand_1.ESInCommand(data.event, replier);
                            fxHandler["do"](function (handler) { return handler(command_1); });
                        }
                        else {
                            sub.acknowledge(data);
                        }
                    }, function (subscription) {
                        if (subscription._dropData.reason == 'userInitiated') {
                            fx.abort();
                        }
                        else {
                            subscription.stop();
                            fx.failWith(new Error('Connection lost'));
                        }
                    }, this.credentials, 1, false)];
            });
        }); }, { name: 'ES.Consumer.' + topic }).open();
    };
    //-- State
    ESBus.prototype.restore = function (StateDataClass, process) {
        var _this = this;
        if (process == null)
            process = StateDataClass.name;
        return new Promise(function (resolve) {
            return _this.last(process, 1, function (event) { return new ESState_1.ESInState(StateDataClass, event); }).then(function (result) {
                if (result.length == 0)
                    return resolve(null);
                else
                    return resolve(result[0]);
            });
        });
    };
    ESBus.prototype.save = function (state) {
        var process = state.process;
        var event = new ESState_1.ESOutState(state);
        return this.publish(process, -2, [event]);
    };
    //-- helpers
    ESBus.prototype.last = function (stream, count, wrapper) {
        var _this = this;
        return this.connection["do"](function (connection) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (wrapper == null)
                            wrapper = function (event) { return new ESEvent_1.ESInEvent(event); };
                        return [4 /*yield*/, connection.readStreamEventsBackward(stream, -1, count, true, this.credentials)];
                    case 1: return [2 /*return*/, (_a.sent())
                            .events.map(function (data) { return wrapper(data.event); }).reverse()];
                }
            });
        }); });
    };
    ESBus.prototype.tweak = function (stream, version, metadata) {
        var _this = this;
        return this.connection["try"](function (connection, fx) {
            return new Promise(function (resolve, reject) {
                connection.setStreamMetadataRaw(stream, version, metadata, _this.credentials)
                    .then(resolve)["catch"](function (e) {
                    if (e.name == 'WrongExpectedVersionError')
                        return reject(e);
                    else
                        return fx.failWith(e);
                });
            });
        });
    };
    return ESBus;
}());
exports.ESBus = ESBus;
