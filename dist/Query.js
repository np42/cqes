"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serializable_1 = require("./Serializable");
class Query extends Serializable_1.Serializable {
    constructor(view, method, data = {}, meta = {}) {
        super();
        this.view = view;
        this.createdAt = new Date();
        this.method = method;
        this.data = data;
        this.meta = meta;
    }
}
exports.Query = Query;
//# sourceMappingURL=Query.js.map