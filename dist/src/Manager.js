"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Component = require("./Component");
class Manager extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Manager' }, props), children);
    }
    empty() {
        return [];
    }
    handle(state, command) {
        const method = 'handle' + command.order;
        if (method in this) {
            this.logger.log('Handle %s : %s %j', command.key, command.order, command.data);
            return this[method](state, command);
        }
        else {
            this.logger.log('Skip %s : %s %j', command.key, command.order, command.data);
            return Promise.resolve(this.empty());
        }
    }
}
exports.Manager = Manager;
//# sourceMappingURL=Manager.js.map