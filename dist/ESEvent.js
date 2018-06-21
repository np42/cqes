"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Event_1 = require("./Event");
class ESInEvent extends Event_1.InEvent {
    constructor(message) {
        const data = {};
        try {
            Object.assign(data, JSON.parse(message.data.toString()));
        }
        catch (e) { }
        const meta = {};
        try {
            Object.assign(meta, JSON.parse(message.metadata.toString() || null));
        }
        catch (e) { }
        super(message.eventStreamId, message.eventType, data, meta);
        this.createdAt = new Date(message.createdEpoch);
        this.number = message.eventNumber.low;
    }
}
exports.ESInEvent = ESInEvent;
//# sourceMappingURL=ESEvent.js.map