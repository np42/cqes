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
    empty() {
        return null;
    }
    load(key) {
        return Promise.resolve(new State_1.State(key));
    }
    resolve(query, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = 'resolve' + query.method;
            if (method in this) {
                this.logger.log('Resolving %s -> %s', query.view, query.method);
                try {
                    const result = yield this[method](query, buffer);
                    if (result instanceof Reply_1.Reply)
                        return result;
                    return new Reply_1.Reply(null, result);
                }
                catch (error) {
                    if (error instanceof Reply_1.Reply)
                        return error;
                    return new Reply_1.Reply(error);
                }
            }
            else {
                this.logger.log('Ignoring %s -> %s', query.view, query.method);
                return new Reply_1.Reply(null, null);
            }
        });
    }
}
exports.Repository = Repository;
//# sourceMappingURL=Repository.js.map