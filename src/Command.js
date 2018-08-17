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
var Command = /** @class */ (function () {
    function Command(topic, name, data, meta) {
        this.topic = topic;
        this.createdAt = new Date();
        this.name = name;
        if (!(data instanceof Object))
            data = {};
        this.data = data;
        if (!(meta instanceof Object))
            meta = {};
        this.meta = meta;
    }
    return Command;
}());
var InCommand = /** @class */ (function (_super) {
    __extends(InCommand, _super);
    function InCommand(reply, topic, name, data, meta) {
        var _this = _super.call(this, topic, name, data, meta) || this;
        _this.pulledAt = new Date();
        if (reply == null)
            reply = function (action, reason) { return void (0); };
        Object.defineProperty(_this, 'reply', { value: reply });
        return _this;
    }
    InCommand.prototype.ack = function () { this.reply('ack'); };
    InCommand.prototype.cancel = function (reason) { this.reply('cancel', reason); };
    return InCommand;
}(Command));
exports.InCommand = InCommand;
var OutCommand = /** @class */ (function (_super) {
    __extends(OutCommand, _super);
    function OutCommand(topic, instance, meta) {
        return _super.call(this, topic, instance.constructor.name, instance, meta) || this;
    }
    OutCommand.prototype.serialize = function () {
        return new Buffer(JSON.stringify(this));
    };
    return OutCommand;
}(Command));
exports.OutCommand = OutCommand;
var CommandData = /** @class */ (function () {
    function CommandData() {
    }
    return CommandData;
}());
exports.CommandData = CommandData;
