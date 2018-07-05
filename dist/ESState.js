"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const State_1 = require("./State");
const Event_1 = require("./Event");
class ESInState extends State_1.InState {
    constructor(message) {
        const payload = { data: null, position: -1 };
        try {
            Object.assign(payload, JSON.parse(message.data.toString()));
        }
        catch (e) { }
        const meta = {};
        try {
            Object.assign(meta, JSON.parse(message.metadata.toString() || null));
        }
        catch (e) { }
        const data = payload.data;
        super(message.eventStreamId, payload.position, data, meta);
        this.createdAt = new Date(message.createdEpoch);
    }
}
exports.ESInState = ESInState;
class ESOutState extends Event_1.OutEvent {
    constructor(state) {
        const payload = { position: state.position, data: state.data };
        super(state.process, 'Snapshot', payload, state.meta);
    }
}
exports.ESOutState = ESOutState;
//# sourceMappingURL=ESState.js.map