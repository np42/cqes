"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Aggregate {
    apply(event) {
        if (!(event.type in this))
            return this;
        this[event.type](event.data);
        return this;
    }
}
exports.Aggregate = Aggregate;
//# sourceMappingURL=Aggregte.js.map