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
var Logger_1 = require("./Logger");
var Fx_1 = require("./Fx");
var CQESBus_1 = require("./CQESBus");
var Query_1 = require("./Query");
var State_1 = require("./State");
var Service = /** @class */ (function () {
    function Service(config) {
        var _this = this;
        this.config = config;
        this.name = 'Service';
        this._name = { toString: function () { return _this.name; }, toJSON: function () { return _this.name; } };
        this.color = 'yellow';
        this._color = { toString: function () { return _this.color; } };
        this.logger = new Logger_1["default"](this._name, this._color);
        this.bus = config.Bus ? new CQESBus_1.CQESBus(config.Bus, this._name) : null;
        this.stream = null;
    }
    Service.prototype.dispatch = function (state, command) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var enricher, arity, commands, _a, _b, _c, err_1, events, err_2;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        this.logger.log('%cyan %red [ %yellow ] %s', '<<', 'Command', command.name, command.topic);
                        enricher = '$' + command.name;
                        if (!!(command.name in this)) return [3 /*break*/, 2];
                        this.logger.warn('Command dropped:', command);
                        return [4 /*yield*/, command.ack()];
                    case 1: return [2 /*return*/, _d.sent()];
                    case 2:
                        if (!(enricher in this)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this[enricher](command)];
                    case 3:
                        command = _d.sent();
                        _d.label = 4;
                    case 4:
                        arity = this[command.name].length;
                        if (!(arity == 1)) return [3 /*break*/, 11];
                        commands = [];
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        _b = (_a = Array.prototype.push).apply;
                        _c = [commands];
                        return [4 /*yield*/, this[command.name](command)];
                    case 6:
                        _b.apply(_a, _c.concat([_d.sent()]));
                        return [3 /*break*/, 8];
                    case 7:
                        err_1 = _d.sent();
                        setTimeout(function () { return command.cancel(); }, 10000); // Delay cancel to avoid retry loop of death
                        this.logger.error(err_1);
                        return [2 /*return*/];
                    case 8: return [4 /*yield*/, this.request(commands)];
                    case 9:
                        _d.sent();
                        return [4 /*yield*/, command.ack()];
                    case 10:
                        _d.sent();
                        return [3 /*break*/, 19];
                    case 11:
                        if (!(arity == 2)) return [3 /*break*/, 19];
                        events = [];
                        _d.label = 12;
                    case 12:
                        _d.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, this[command.name](state, command)];
                    case 13:
                        events = _d.sent();
                        if (!(events instanceof Array)) {
                            events = [];
                            this.logger.error("%s.%s returns bad value", this.name || '(anonymous)', command.name);
                        }
                        return [3 /*break*/, 15];
                    case 14:
                        err_2 = _d.sent();
                        setTimeout(function () { return command.cancel(); }, 10000); // Delay cancel to avoid retry loop of death
                        this.logger.error(err_2);
                        return [2 /*return*/];
                    case 15:
                        events.forEach(function (event) { return Object.assign(event.meta, { source: _this._name }); });
                        if (!(events.length > 0)) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.publish(events)];
                    case 16:
                        _d.sent();
                        _d.label = 17;
                    case 17: return [4 /*yield*/, command.ack()];
                    case 18:
                        _d.sent();
                        _d.label = 19;
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    Service.prototype.stop = function () {
        this.bus.stop();
    };
    //--
    // request
    Service.prototype.request = function (commands) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, commands_1, command;
            return __generator(this, function (_a) {
                for (_i = 0, commands_1 = commands; _i < commands_1.length; _i++) {
                    command = commands_1[_i];
                    this.logger.log('%magenta %red [ %yellow ] %s', '>>', 'Command', command.name, command.topic);
                    this.bus.C.command(command);
                }
                return [2 /*return*/];
            });
        });
    };
    // listen
    Service.prototype.listen = function (topic, state, types, applicant) {
        if (applicant === void 0) { applicant = this; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (applicant == null || applicant.dispatch == null)
                    debugger;
                if (state == null)
                    state = new State_1.State(State_1.StateData);
                if (this.stream == null)
                    this.stream = Fx_1.Fx.create(null, { name: 'Empty' }).open();
                return [2 /*return*/, this.stream.merge(function (_, fx) { return __awaiter(_this, void 0, void 0, function () {
                        var _this = this;
                        var subscription;
                        return __generator(this, function (_a) {
                            this.logger.log('Start listening %s', topic);
                            subscription = this.bus.C.listen(topic, function (command) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    if (command.name in types)
                                        command.data = new types[command.name](command.data);
                                    applicant.dispatch(state, command);
                                    return [2 /*return*/];
                                });
                            }); });
                            subscription.on('aborted', function () { _this.logger.log('Stop listening %s', topic); });
                            return [2 /*return*/, subscription];
                        });
                    }); }, { name: 'Service.Listen.' + topic })];
            });
        });
    };
    // publish
    Service.prototype.publish = function (events) {
        return __awaiter(this, void 0, void 0, function () {
            var perStream, _i, events_1, event_1, _a, perStream_1, _b, stream, events_2, types;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        perStream = new Map();
                        for (_i = 0, events_1 = events; _i < events_1.length; _i++) {
                            event_1 = events_1[_i];
                            if (!perStream.has(event_1.stream))
                                perStream.set(event_1.stream, [event_1]);
                            else
                                perStream.get(event_1.stream).push(event_1);
                        }
                        _a = 0, perStream_1 = perStream;
                        _c.label = 1;
                    case 1:
                        if (!(_a < perStream_1.length)) return [3 /*break*/, 4];
                        _b = perStream_1[_a], stream = _b[0], events_2 = _b[1];
                        types = events_2.map(function (e) { return e.type; }).join(' ');
                        this.logger.log('%magenta %green [ %yellow ] %s', '>>', 'Event', types, stream);
                        return [4 /*yield*/, this.bus.E.publish(stream, -2, events_2)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _a++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // rehydrate
    Service.prototype.rehydrate = function (stream, StateDataClass, process) {
        var _this = this;
        if (this.stream != null)
            throw new Error('Hydrated stream already bound');
        var fxName = function (action) { return 'Service.Rehydrate.' + stream + '.' + action; };
        return this.stream = new Fx_1.Fx(function (_, fx) { return __awaiter(_this, void 0, void 0, function () {
            var restoredState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.log('Retrieving state %s for rehydratation', process || StateDataClass.name);
                        return [4 /*yield*/, this.bus.S.restore(StateDataClass)];
                    case 1:
                        restoredState = _a.sent();
                        if (restoredState != null)
                            return [2 /*return*/, restoredState];
                        return [2 /*return*/, new State_1.State(StateDataClass, -1)];
                }
            });
        }); }, { name: fxName('Snapshot'), nocache: true }).merge(function (state) {
            var session = { stream: stream, state: state };
            _this.logger.log('Start rehydrating %s from %s', stream, state.position);
            return new Promise(function (resolve) {
                var fx = _this.bus.E.subscribe(stream, state.position, function (event) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (event.type == '$liveReached')
                            resolve(fx);
                        state.data.apply(event);
                        return [2 /*return*/];
                    });
                }); });
            });
        }, { name: fxName('Consume') }).open();
    };
    // subscribe
    Service.prototype.subscribe = function (stream, state) {
        var _this = this;
        this.logger.log('Start subscription %s', stream);
        return this.bus.E.subscribe(stream, null, function (event) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.logger.log('%cyan %green [ %yellow ] %s@%s', '<<', 'Event', event.type, event.number, event.stream);
                state.data.apply(event);
                return [2 /*return*/];
            });
        }); });
    };
    // last
    Service.prototype.last = function (stream, count) {
        return this.bus.E.last(stream, count);
    };
    // watch
    Service.prototype.watch = function (pstream, StateDataClass, automates) {
        var _this = this;
        this.logger.log('Start watching %s', pstream);
        return this.bus.E.consume(pstream, function (command) { return __awaiter(_this, void 0, void 0, function () {
            var events, id, state, rules, commands, _i, rules_1, automate, commandsSet, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.log('%cyan %green %s:%s', '<<', 'Command', command.topic, command.name);
                        return [4 /*yield*/, this.last(command.topic, 1000)];
                    case 1:
                        events = _a.sent();
                        while (events.length > 0 && events[events.length - 1].number > command.number)
                            events.pop();
                        id = command.topic.substr(command.topic.indexOf('-') + 1);
                        state = new State_1.State(StateDataClass, id);
                        state.data.apply(events);
                        rules = automates.get(command.name);
                        commands = [];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 10]);
                        _i = 0, rules_1 = rules;
                        _a.label = 3;
                    case 3:
                        if (!(_i < rules_1.length)) return [3 /*break*/, 6];
                        automate = rules_1[_i];
                        return [4 /*yield*/, automate(state, command)];
                    case 4:
                        commandsSet = _a.sent();
                        Array.prototype.push.apply(commands, commandsSet);
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        if (!(commands.length > 0)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.request(commands)];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        command.ack();
                        return [3 /*break*/, 10];
                    case 9:
                        e_1 = _a.sent();
                        this.logger.error('%green Rejected:', 'Command', e_1);
                        command.cancel();
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        }); });
    };
    // query
    Service.prototype.query = function (view, method, data) {
        return __awaiter(this, void 0, void 0, function () {
            var query, reply;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.log('%magenta %blue [ %yellow ] %s %j', '>>', 'Query', method, view, data);
                        query = new Query_1.OutQuery(view, method, data);
                        return [4 /*yield*/, this.bus.Q.query(query, 10)];
                    case 1:
                        reply = _a.sent();
                        this.logger.debug('%cyan %blue [ %yellow ] %s %j', '<<', 'Reply', method, view, reply.data);
                        if (reply.error)
                            throw new Error(reply.error);
                        return [2 /*return*/, reply.data];
                }
            });
        });
    };
    // serve
    Service.prototype.serve = function (view, state, handlers) {
        var _this = this;
        if (this.stream == null)
            this.stream = Fx_1.Fx.create(null).open();
        return this.stream.merge(function (_, fx) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.logger.log('Start serving %s', view);
                return [2 /*return*/, this.bus.Q.serve(view, function (query) { return __awaiter(_this, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    this.logger.log('%cyan %blue [ %yellow ] %s %j', '<<', 'Query', query.method, view, query.data);
                                    if (!(query.method in handlers)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, handlers[query.method](state, query.data)];
                                case 1:
                                    result = _a.sent();
                                    this.logger.debug('%magenta %blue [ %yellow ] %s %j', '>>', 'Reply', query.method, view, result);
                                    return [2 /*return*/, query.resolve(result)];
                                case 2: return [2 /*return*/, query.reject('Unknow how to deal with ' + query.method)];
                            }
                        });
                    }); })];
            });
        }); }, { name: 'Service.Serve.' + view });
    };
    return Service;
}());
exports.Service = Service;
var AutomateCollection = /** @class */ (function () {
    function AutomateCollection() {
        this.automates = new Map();
    }
    AutomateCollection.prototype.onAll = function (automate) {
        this.on('$all', automate);
    };
    AutomateCollection.prototype.on = function (names, automate) {
        if (typeof names == 'string')
            names = [names];
        for (var _i = 0, names_1 = names; _i < names_1.length; _i++) {
            var name_1 = names_1[_i];
            if (!this.automates.has(name_1))
                this.automates.set(name_1, []);
            this.automates.get(name_1).push(automate);
        }
    };
    AutomateCollection.prototype.get = function (name) {
        var all = this.automates.get('$all') || [];
        var named = this.automates.get(name) || [];
        return named.concat(all);
    };
    return AutomateCollection;
}());
exports.AutomateCollection = AutomateCollection;
