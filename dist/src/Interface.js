"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
class Interface {
    constructor(props) {
        this.props = props;
        this.bus = props.bus;
        this.logger = new Logger_1.Logger(props.name + ' :: ' + this.constructor.name, 'magenta');
    }
}
exports.Interface = Interface;
//# sourceMappingURL=Interface.js.map