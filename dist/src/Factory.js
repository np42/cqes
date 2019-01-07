"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Component = require("./Component");
class Factory extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Factory' }, props), children);
    }
    apply(state, events) {
        const version = state.version;
        const newState = events.reduce((state, event) => {
            const method = 'apply' + event.name;
            if (method in this)
                return this[method](state, event) || state;
            return state;
        }, state);
        if (newState.version >= 0) {
            const diff = newState.version - version;
            if (diff === 0) {
                this.logger.log('State %s@%s not changed', newState.version, newState.key);
            }
            else {
                this.logger.log('State %s@%s changed +%s', newState.version, newState.key, diff);
            }
        }
        else {
            this.logger.log('State %s destroyed', newState.key);
        }
        return newState;
    }
}
exports.Factory = Factory;
//# sourceMappingURL=Factory.js.map