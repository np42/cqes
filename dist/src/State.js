"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class State {
    constructor(StateDataClass, data, position) {
        if (StateDataClass == null)
            StateDataClass = DummyStateData;
        if (position == null)
            position = -1;
        this.process = StateDataClass.name;
        this.position = position;
        this.data = new StateDataClass(data);
    }
}
exports.State = State;
class StateData {
    type(event) {
        return event;
    }
    apply(events) {
        if (!(events instanceof Array))
            events = [events];
        for (const event of events) {
            if (!(event.type in this))
                continue;
            const typedEvent = this.type(event);
            this[event.type](typedEvent);
        }
    }
    toString() {
        return this.id;
    }
}
exports.StateData = StateData;
class DummyStateData extends StateData {
}
//# sourceMappingURL=State.js.map