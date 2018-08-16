"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const State_1 = require("./State");
const Event_1 = require("./Event");
class ESInState extends State_1.State {
    constructor(StateDataClass, message) {
        const payload = { data: null, position: -1 };
        try {
            Object.assign(payload, JSON.parse(message.data.toString()));
        }
        catch (e) { }
        const data = payload.data;
        super(StateDataClass, data, payload.position);
    }
}
exports.ESInState = ESInState;
class ESOutState extends Event_1.OutEvent {
    constructor(state) {
        super(state.process, new Snapshoted(state));
    }
}
exports.ESOutState = ESOutState;
class Snapshoted extends Event_1.EventData {
    constructor(data) {
        super();
        this.position = data.position;
        this.timestamp = Date.now();
        this.data = data.data;
    }
}
//# sourceMappingURL=ESState.js.map