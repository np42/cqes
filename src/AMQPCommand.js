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
var Command_1 = require("./Command");
var AMQPInCommand = /** @class */ (function (_super) {
    __extends(AMQPInCommand, _super);
    function AMQPInCommand(message, reply) {
        var _this = this;
        var payload = { topic: null, name: null, createdAt: null,
            data: null, meta: null
        };
        try {
            Object.assign(payload, JSON.parse(message.content.toString()));
        }
        catch (e) { /* Fail silently */ }
        _this = _super.call(this, reply, payload.topic || message.fields.routingKey, payload.name || 'Dummy', payload.data, payload.meta) || this;
        _this.createdAt = new Date(payload.createdAt);
        return _this;
    }
    AMQPInCommand.prototype.cancel = function (reason) { this.reply('reject', reason); };
    return AMQPInCommand;
}(Command_1.InCommand));
exports.AMQPInCommand = AMQPInCommand;
