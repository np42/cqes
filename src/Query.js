"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var Query = /** @class */ (function () {
    function Query(view, method, data, meta) {
        this.view = view;
        this.createdAt = new Date();
        this.method = method;
        this.data = data;
        this.meta = meta || null;
    }
    return Query;
}());
var InQuery = /** @class */ (function (_super) {
    __extends(InQuery, _super);
    function InQuery(reply, view, method, data, meta) {
        var _this = _super.call(this, view, method, data, meta) || this;
        _this.pulledAt = new Date();
        Object.defineProperty(_this, 'reply', { value: reply });
        return _this;
    }
    InQuery.prototype.resolve = function (content) { this.reply(ReplyType.Resolved, content); };
    InQuery.prototype.reject = function (error) { this.reply(ReplyType.Rejected, error); };
    return InQuery;
}(Query));
exports.InQuery = InQuery;
var OutQuery = /** @class */ (function (_super) {
    __extends(OutQuery, _super);
    function OutQuery() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OutQuery.prototype.serialize = function () {
        return new Buffer(JSON.stringify(this));
    };
    return OutQuery;
}(Query));
exports.OutQuery = OutQuery;
var ReplyType;
(function (ReplyType) {
    ReplyType["Resolved"] = "resolve";
    ReplyType["Rejected"] = "reject";
})(ReplyType = exports.ReplyType || (exports.ReplyType = {}));
var Reply = /** @class */ (function () {
    function Reply(error, data) {
        this.type = error != null ? ReplyType.Rejected : ReplyType.Resolved;
        this.error = error;
        this.data = data;
    }
    return Reply;
}());
var InReply = /** @class */ (function (_super) {
    __extends(InReply, _super);
    function InReply(error, data) {
        var _this = _super.call(this, error, data) || this;
        _this.pulledAt = new Date();
        return _this;
    }
    return InReply;
}(Reply));
exports.InReply = InReply;
var OutReply = /** @class */ (function (_super) {
    __extends(OutReply, _super);
    function OutReply() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OutReply.prototype.serialize = function () {
        return new Buffer(JSON.stringify(this));
    };
    return OutReply;
}(Reply));
exports.OutReply = OutReply;
