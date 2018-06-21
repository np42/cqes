"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serializable_1 = require("./Serializable");
class Event extends Serializable_1.Serializable {
    constructor(stream, type, data, meta) {
        super();
        this.stream = stream;
        this.createdAt = new Date();
        this.type = type;
        this.data = data;
        this.meta = meta;
        this.number = -2;
    }
}
exports.Event = Event;
//# sourceMappingURL=Event.js.map