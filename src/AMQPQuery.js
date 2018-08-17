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
var Query_1 = require("./Query");
var AMQPInQuery = /** @class */ (function (_super) {
    __extends(AMQPInQuery, _super);
    function AMQPInQuery(message, reply) {
        var _this = this;
        var payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { /* Fail silently */ }
        _this = _super.call(this, reply, message.fields.routingKey, payload.method || 'Dummy', payload.data || {}, payload.meta || {}) || this;
        _this.createdAt = new Date(payload.createdAt);
        return _this;
    }
    return AMQPInQuery;
}(Query_1.InQuery));
exports.AMQPInQuery = AMQPInQuery;
var AMQPInReply = /** @class */ (function (_super) {
    __extends(AMQPInReply, _super);
    function AMQPInReply(message) {
        var _this = this;
        var payload = {};
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { /* Fail silently */ }
        switch (payload.type) {
            case Query_1.ReplyType.Resolved:
                _this = _super.call(this, null, payload.data) || this;
                break;
            case Query_1.ReplyType.Rejected:
                _this = _super.call(this, payload.error) || this;
                break;
        }
        _this.id = message.properties.correlationId;
        return _this;
    }
    return AMQPInReply;
}(Query_1.InReply));
exports.AMQPInReply = AMQPInReply;
