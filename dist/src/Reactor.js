"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Component = require("./Component");
class Reactor extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Reactor' }, props), children);
    }
    on(state, events) {
        return events.forEach(event => {
            const method = 'on' + event.name;
            if (method in this)
                this[method](state, event);
        });
    }
}
exports.Reactor = Reactor;
//# sourceMappingURL=Reactor.js.map