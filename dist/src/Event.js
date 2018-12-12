"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Event {
    constructor(name, data) {
        this.name = name;
        this.data = data instanceof Object ? data : {};
    }
}
exports.Event = Event;
//# sourceMappingURL=Event.js.map