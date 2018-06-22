"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Event {
    constructor(stream, type, data, meta) {
        this.stream = stream;
        this.type = type;
        this.data = data;
        this.meta = meta;
        this.number = -2;
    }
}
class InEvent extends Event {
    constructor(stream, type, data, meta) {
        super(stream, type, data, meta);
        this.createdAt = new Date();
    }
}
exports.InEvent = InEvent;
class OutEvent extends Event {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutEvent = OutEvent;
//# sourceMappingURL=Event.js.map