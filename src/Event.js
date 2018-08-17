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
var Event = /** @class */ (function () {
    function Event(stream, type, data, meta) {
        this.stream = stream;
        this.type = type;
        if (!(data instanceof Object))
            data = {};
        this.data = data;
        if (!(meta instanceof Object))
            meta = {};
        meta.createdAt = Date.now();
        this.meta = meta;
        this.number = -2;
    }
    Object.defineProperty(Event.prototype, "entityId", {
        get: function () {
            return this.stream.substr(this.stream.indexOf('-') + 1);
        },
        enumerable: true,
        configurable: true
    });
    return Event;
}());
var InEvent = /** @class */ (function (_super) {
    __extends(InEvent, _super);
    function InEvent(stream, type, data, meta) {
        var _this = _super.call(this, stream, type, data, meta) || this;
        _this.createdAt = new Date();
        return _this;
    }
    return InEvent;
}(Event));
exports.InEvent = InEvent;
var OutEvent = /** @class */ (function (_super) {
    __extends(OutEvent, _super);
    function OutEvent(stream, instance, meta) {
        return _super.call(this, stream, instance.constructor.name, instance, meta) || this;
    }
    OutEvent.prototype.serialize = function () {
        return new Buffer(JSON.stringify(this));
    };
    return OutEvent;
}(Event));
exports.OutEvent = OutEvent;
var EventData = /** @class */ (function () {
    function EventData() {
    }
    return EventData;
}());
exports.EventData = EventData;
