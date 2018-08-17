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
var ESInCommand = /** @class */ (function (_super) {
    __extends(ESInCommand, _super);
    function ESInCommand(message, reply) {
        var _this = this;
        var data = {};
        try {
            Object.assign(data, JSON.parse(message.data.toString()));
        }
        catch (e) { /* Fail silently */ }
        var meta = {};
        try {
            Object.assign(meta, JSON.parse(message.metadata.toString() || null));
        }
        catch (e) { /* Fail silently */ }
        _this = _super.call(this, reply, message.eventStreamId, message.eventType, data, meta) || this;
        _this.createdAt = new Date(message.createdEpoch);
        _this.number = message.eventNumber.low;
        return _this;
    }
    ESInCommand.prototype.ack = function () { this.reply('acknowledge'); };
    ESInCommand.prototype.cancel = function () { this.reply('fail'); };
    return ESInCommand;
}(Command_1.InCommand));
exports.ESInCommand = ESInCommand;
