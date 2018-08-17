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
var State_1 = require("./State");
var Event_1 = require("./Event");
var ESInState = /** @class */ (function (_super) {
    __extends(ESInState, _super);
    function ESInState(StateDataClass, message) {
        var _this = this;
        var payload = { data: null, position: -1 };
        try {
            Object.assign(payload, JSON.parse(message.data.toString()));
        }
        catch (e) { /* Fail silently */ }
        var data = payload.data;
        _this = _super.call(this, StateDataClass, data, payload.position) || this;
        return _this;
    }
    return ESInState;
}(State_1.State));
exports.ESInState = ESInState;
var ESOutState = /** @class */ (function (_super) {
    __extends(ESOutState, _super);
    function ESOutState(state) {
        return _super.call(this, state.process, new Snapshoted(state)) || this;
    }
    return ESOutState;
}(Event_1.OutEvent));
exports.ESOutState = ESOutState;
var Snapshoted = /** @class */ (function (_super) {
    __extends(Snapshoted, _super);
    function Snapshoted(data) {
        var _this = _super.call(this) || this;
        _this.position = data.position;
        _this.timestamp = Date.now();
        _this.data = data.data;
        return _this;
    }
    return Snapshoted;
}(Event_1.EventData));
