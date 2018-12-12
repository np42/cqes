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
const Component = require("./Component");
const Manager = require("./Manager");
const Buffer = require("./Buffer");
const Responder = require("./Responder");
const Reactor = require("./Reactor");
class Aggregator extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Aggregator', color: 'green' }, props), children);
        this.manager = this.sprout('Manager', Manager);
        this.buffer = this.sprout('Buffer', Buffer);
        this.responder = this.sprout('Responder', Responder);
        this.reactor = this.sprout('Reactor', Reactor);
    }
    start() {
        return this.buffer.start();
    }
    stop() {
        return this.buffer.stop();
    }
    handle(command) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = command.key;
            let tryCount = this.props.tryCount || 10;
            while (--tryCount >= 0) {
                const state = yield this.buffer.get(key);
                const events = yield this.manager.handle(state, command);
                try {
                    const newState = this.buffer.update(key, state.version, events);
                    this.reactor.on(newState, events);
                    return this.responder.responde(command, newState, events);
                }
                catch (e) {
                    if (tryCount > 0)
                        continue;
                    this.logger.warn('Discarding command %s: %s', command.key, String(e));
                    throw e;
                }
            }
        });
    }
    resolve(query) {
        return this.buffer.resolve(query);
    }
}
exports.Aggregator = Aggregator;
//# sourceMappingURL=Aggregator.js.map