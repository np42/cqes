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
const Logger_1 = require("./Logger");
const Fx_1 = require("./Fx");
const CQESBus_1 = require("./CQESBus");
const Query_1 = require("./Query");
const State_1 = require("./State");
class Service {
    constructor(config) {
        this.config = config;
        this.name = 'Service';
        this._name = { toString: () => this.name, toJSON: () => this.name };
        this.color = 'yellow';
        this._color = { toString: () => this.color };
        this.logger = new Logger_1.default(this._name, this._color);
        this.bus = config.Bus ? new CQESBus_1.CQESBus(config.Bus) : null;
        this.stream = null;
    }
    dispatch(state, command) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('%cyan %red [ %yellow ] %s', '<<', 'Command', command.name, command.topic);
            const enricher = '$' + command.name;
            if (!(command.name in this)) {
                this.logger.warn('Command dropped:', command);
                return yield command.ack();
            }
            if (enricher in this)
                command = yield this[enricher](command);
            const arity = this[command.name].length;
            if (arity == 1) {
                const commands = [];
                try {
                    Array.prototype.push.apply(commands, yield this[command.name](command));
                }
                catch (err) {
                    setTimeout(() => command.cancel(), 10000);
                    this.logger.error(err);
                    return;
                }
                yield this.request(commands);
                yield command.ack();
            }
            else if (arity == 2) {
                let events = [];
                try {
                    events = yield this[command.name](state, command);
                    if (!(events instanceof Array)) {
                        events = [];
                        this.logger.error("%s.%s returns bad value", this.name || '(anonymous)', command.name);
                    }
                }
                catch (err) {
                    setTimeout(() => command.cancel(), 10000);
                    this.logger.error(err);
                    return;
                }
                events.forEach(event => Object.assign(event.meta, { source: this._name }));
                if (events.length > 0)
                    yield this.publish(events);
                yield command.ack();
            }
        });
    }
    stop() {
        this.bus.stop();
    }
    request(commands) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const command of commands) {
                this.logger.log('%magenta %red [ %yellow ] %s', '>>', 'Command', command.name, command.topic);
                this.bus.C.command(command);
            }
        });
    }
    listen(topic, state, types, applicant = this) {
        return __awaiter(this, void 0, void 0, function* () {
            if (applicant == null || applicant.dispatch == null)
                debugger;
            if (state == null)
                state = new State_1.State(State_1.StateData);
            if (this.stream == null)
                this.stream = Fx_1.Fx.create(null, { name: 'Empty' }).open();
            return this.stream.merge((_, fx) => __awaiter(this, void 0, void 0, function* () {
                this.logger.log('Start listening %s', topic);
                const subscription = this.bus.C.listen(topic, (command) => __awaiter(this, void 0, void 0, function* () {
                    if (command.name in types)
                        command.data = new types[command.name](command.data);
                    applicant.dispatch(state, command);
                }));
                subscription.on('aborted', () => { this.logger.log('Stop listening %s', topic); });
                return subscription;
            }), { name: 'Service.Listen.' + topic });
        });
    }
    publish(events) {
        return __awaiter(this, void 0, void 0, function* () {
            const perStream = new Map();
            for (const event of events) {
                if (!perStream.has(event.stream))
                    perStream.set(event.stream, [event]);
                else
                    perStream.get(event.stream).push(event);
            }
            for (const [stream, events] of perStream) {
                const types = events.map((e) => e.type).join(' ');
                this.logger.log('%magenta %green [ %yellow ] %s', '>>', 'Event', types, stream);
                yield this.bus.E.publish(stream, -2, events);
            }
        });
    }
    rehydrate(stream, StateDataClass, process) {
        if (this.stream != null)
            throw new Error('Hydrated stream already bound');
        const fxName = (action) => 'Service.Rehydrate.' + stream + '.' + action;
        return this.stream = new Fx_1.Fx((_, fx) => __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Retrieving state %s for rehydratation', process || StateDataClass.name);
            const restoredState = yield this.bus.S.restore(StateDataClass);
            if (restoredState != null)
                return restoredState;
            return new State_1.State(StateDataClass, -1);
        }), { name: fxName('Snapshot'), nocache: true }).merge((state) => {
            this.logger.log('Start rehydrating %s from %s', stream, state.position);
            return new Promise(resolve => {
                const fx = this.bus.E.subscribe(stream, state.position, (event) => __awaiter(this, void 0, void 0, function* () {
                    if (event.type == '$liveReached')
                        resolve(fx);
                    state.data.apply(event);
                }));
            });
        }, { name: fxName('Consume') }).open();
    }
    subscribe(stream, state) {
        this.logger.log('Start subscription %s', stream);
        return this.bus.E.subscribe(stream, null, (event) => __awaiter(this, void 0, void 0, function* () {
            this.logger.log('%cyan %green [ %yellow ] %s@%s', '<<', 'Event', event.type, event.number, event.stream);
            state.data.apply(event);
        }));
    }
    last(stream, count) {
        return this.bus.E.last(stream, count);
    }
    watch(pstream, StateDataClass, automates) {
        this.logger.log('Start watching %s', pstream);
        return this.bus.E.consume(pstream, (command) => __awaiter(this, void 0, void 0, function* () {
            this.logger.log('%cyan %green %s:%s', '<<', 'Command', command.topic, command.name);
            const events = yield this.last(command.topic, 1000);
            while (events.length > 0 && events[events.length - 1].number > command.number)
                events.pop();
            const id = command.topic.substr(command.topic.indexOf('-') + 1);
            const state = new State_1.State(StateDataClass, id);
            state.data.apply(events);
            const rules = automates.get(command.name);
            const commands = [];
            try {
                for (const automate of rules) {
                    const commandsSet = yield automate(state, command);
                    Array.prototype.push.apply(commands, commandsSet);
                }
                if (commands.length > 0)
                    yield this.request(commands);
                command.ack();
            }
            catch (e) {
                this.logger.error('%green Rejected:', 'Command', e);
                command.cancel();
            }
        }));
    }
    query(view, method, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('%magenta %blue [ %yellow ] %s %j', '>>', 'Query', method, view, data);
            const query = new Query_1.OutQuery(view, method, data);
            const reply = yield this.bus.Q.query(query, 10);
            this.logger.debug('%cyan %blue [ %yellow ] %s %j', '<<', 'Reply', method, view, reply.data);
            if (reply.error)
                throw new Error(reply.error);
            return reply.data;
        });
    }
    serve(view, state, handlers) {
        if (this.stream == null)
            this.stream = Fx_1.Fx.create(null).open();
        return this.stream.merge((_, fx) => __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Start serving %s', view);
            return this.bus.Q.serve(view, (query) => __awaiter(this, void 0, void 0, function* () {
                this.logger.log('%cyan %blue [ %yellow ] %s %j', '<<', 'Query', query.method, view, query.data);
                if (query.method in handlers) {
                    const result = yield handlers[query.method](state, query.data);
                    this.logger.debug('%magenta %blue [ %yellow ] %s %j', '>>', 'Reply', query.method, view, result);
                    return query.resolve(result);
                }
                else {
                    return query.reject('Unknow how to deal with ' + query.method);
                }
            }));
        }), { name: 'Service.Serve.' + view });
    }
}
exports.Service = Service;
class AutomateCollection {
    constructor() {
        this.automates = new Map();
    }
    onAll(automate) {
        this.on('$all', automate);
    }
    on(names, automate) {
        if (typeof names == 'string')
            names = [names];
        for (const name of names) {
            if (!this.automates.has(name))
                this.automates.set(name, []);
            this.automates.get(name).push(automate);
        }
    }
    get(name) {
        const all = this.automates.get('$all') || [];
        const named = this.automates.get(name) || [];
        return named.concat(all);
    }
}
exports.AutomateCollection = AutomateCollection;
//# sourceMappingURL=Service.js.map