"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const State_1 = require("./State");
const Event_1 = require("./Event");
class ESInState extends State_1.InState {
    constructor(message) {
        const payload = { data: null, versions: null };
        try {
            Object.assign(payload, JSON.parse(message.data.toString()));
        }
        catch (e) { }
        const meta = {};
        try {
            Object.assign(meta, JSON.parse(message.metadata.toString() || null));
        }
        catch (e) { }
        const versions = new Map();
        for (const key in payload.versions)
            versions.set(key, payload.versions[key]);
        const data = payload.data;
        super(message.eventStreamId, versions, data, meta);
        this.createdAt = new Date(message.createdEpoch);
    }
}
exports.ESInState = ESInState;
class ESOutState extends Event_1.OutEvent {
    constructor(state) {
        const payload = { versions: {}, data: state.data };
        for (const [key, value] of state.versions)
            payload.versions[key] = value;
        super(state.process, 'Snapshot', payload, state.meta);
    }
}
exports.ESOutState = ESOutState;
//# sourceMappingURL=ESState.js.map