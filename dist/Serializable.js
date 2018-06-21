"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Serializable {
    serialize() {
        return new Buffer(JSON.stringify(this));
    }
}
exports.Serializable = Serializable;
//# sourceMappingURL=Serializable.js.map