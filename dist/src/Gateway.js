"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Component = require("./Component");
class Gateway extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Gateway', color: 'yellow' }, props), children);
    }
    start() {
        return Promise.resolve(true);
    }
    stop() {
        return Promise.resolve();
    }
}
exports.Gateway = Gateway;
//# sourceMappingURL=Gateway.js.map