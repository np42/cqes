"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serializable_1 = require("./Serializable");
class Command extends Serializable_1.Serializable {
    constructor(topic, type, data, meta) {
        super();
        this.topic = topic;
        this.createdAt = new Date();
        this.type = type;
        this.data = data;
        this.meta = meta;
    }
}
exports.Command = Command;
//# sourceMappingURL=Command.js.map