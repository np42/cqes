"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serializable_1 = require("./Serializable");
var Type;
(function (Type) {
    Type["Resolved"] = "resolve";
    Type["Rejected"] = "reject";
})(Type = exports.Type || (exports.Type = {}));
class Reply extends Serializable_1.Serializable {
    constructor(type, value) {
        super();
        this.type = type || Type.Rejected;
        this.value = value || {};
    }
}
exports.Reply = Reply;
//# sourceMappingURL=Reply.js.map