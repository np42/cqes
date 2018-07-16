"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Event {
    constructor(stream, type, data, meta) {
        this.stream = stream;
        this.type = type;
        if (!(data instanceof Object))
            data = {};
        this.data = data;
        if (!(meta instanceof Object))
            meta = {};
        meta.createdAt = Date.now();
        this.meta = meta;
        this.number = -2;
    }
    get entityId() {
        return this.stream.substr(this.stream.indexOf('-') + 1);
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
    constructor(stream, instance, meta) {
        super(stream, instance.constructor.name, instance, meta);
    }
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.OutEvent = OutEvent;
class EventData {
}
exports.EventData = EventData;
//# sourceMappingURL=Event.js.map