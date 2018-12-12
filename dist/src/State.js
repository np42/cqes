"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const merge = require("deepmerge");
const MERGE_OPTIONS = { arrayMerge: (l, r, o) => r };
class State {
    constructor(key, version, status, data) {
        this.key = key;
        this.status = status || null;
        this.version = version >= 0 ? version : -1;
        this.data = data || null;
    }
    get id() {
        const offset = this.key.indexOf('-');
        return offset > 0 ? this.key.substr(offset + 1) : this.key;
    }
    next(status, partial) {
        const newStatus = status || this.status;
        const data = partial ? merge(this.data, partial, MERGE_OPTIONS) : this.data;
        return new State(this.key, this.version + 1, newStatus, data);
    }
    end() {
        return new State(this.key, -1, null, null);
    }
}
exports.State = State;
//# sourceMappingURL=State.js.map