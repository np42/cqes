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
const Repository = require("./Repository");
const Factory = require("./Factory");
const State_1 = require("./State");
const CachingMap = require('caching-map');
class Buffer extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Buffer' }, props), children);
        this.buffer = new CachingMap(props.size > 0 ? props.size : null);
        this.ttl = props.ttl > 0 ? props.ttl : null;
        this.repository = this.sprout('Repository', Repository);
        this.factory = this.sprout('Factory', Factory);
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.buffer.get(key);
            if (state != null) {
                return state;
            }
            else if (this.repository != null) {
                const state = yield this.repository.load(key);
                this.buffer.set(key, state);
                return state;
            }
            else {
                return new State_1.State(key);
            }
        });
    }
    update(key, expectedVersion, events) {
        const state = this.buffer.get(key);
        if (state.version != expectedVersion)
            throw new Error('State has changed');
        this.logger.log('%s apply %s', key, events.map(e => e.name).join(', '));
        const newState = this.factory.apply(state, events);
        this.logger.log('State %s@%s: %j', newState.version, newState.key, newState.data);
        if (newState == -1)
            this.buffer.delete(key);
        else
            this.buffer.set(key, newState, { ttl: this.ttl });
        this.repository.save(newState, events);
        return newState;
    }
    resolve(query) {
        return this.repository.resolve(query, this.buffer);
    }
    start() {
        return this.repository.start();
    }
    stop() {
        return this.repository.stop();
    }
}
exports.Buffer = Buffer;
//# sourceMappingURL=Buffer.js.map