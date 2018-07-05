"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class State {
    constructor(process, position, data, meta) {
        this.process = process;
        this.position = position;
        this.data = data;
        this.meta = meta;
    }
}
class InState extends State {
    constructor(process, position, data, meta) {
        super(process, position, data, meta);
        this.createdAt = new Date();
    }
}
exports.InState = InState;
class OutState extends State {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutState = OutState;
//# sourceMappingURL=State.js.map