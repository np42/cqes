"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Gateway = require("./Gateway");
const Reply_1 = require("./Reply");
const State_1 = require("./State");
class Repository extends Gateway.Gateway {
    constructor(props, children) {
        super(Object.assign({ type: 'Repository' }, props, { color: 'cyan' }), children);
    }
    start() {
        return Promise.resolve(true);
    }
    stop() {
        return Promise.resolve();
    }
    save(state, events) {
        const method = 'save' + state.status;
        if (method in this) {
            this.logger.log('Saving %s@%s -> %s', state.version, state.key, state.status);
            return this[method](state, events);
        }
        else {
            return Promise.resolve();
        }
    }
    load(key) {
        return Promise.resolve(new State_1.State(key));
    }
    resolve(query, buffer) {
        const method = 'resolve' + query.method;
        if (method in this) {
            this.logger.log('Resolving %s -> %s', query.view, query.method);
            return this[method](query, buffer);
        }
        else {
            this.logger.log('Ignoring %s -> %s', query.view, query.method);
            return Promise.resolve(new Reply_1.Reply(null, null));
        }
    }
}
exports.Repository = Repository;
//# sourceMappingURL=Repository.js.map