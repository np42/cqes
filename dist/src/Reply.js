"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Status;
(function (Status) {
    Status["Resolved"] = "resolve";
    Status["Rejected"] = "reject";
})(Status = exports.Status || (exports.Status = {}));
class Reply {
    constructor(error, data, meta) {
        if (error != null) {
            this.status = Status.Rejected;
            this.data = error;
            this.meta = meta;
        }
        else {
            this.status = Status.Resolved;
            this.data = data;
            this.meta = meta;
        }
    }
    assert() {
        if (this.status == Status.Rejected)
            throw this.data;
        return this.data;
    }
    get() {
        if (this.status == Status.Rejected)
            return null;
        return this.data;
    }
}
exports.Reply = Reply;
class InReply extends Reply {
    constructor(error, data) {
        super(error, data);
        this.pulledAt = new Date();
    }
}
exports.InReply = InReply;
class OutReply extends Reply {
    serialize() {
        return Buffer.from(JSON.stringify(this));
    }
}
exports.OutReply = OutReply;
//# sourceMappingURL=Reply.js.map