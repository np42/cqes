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
var State = /** @class */ (function () {
    function State(StateDataClass, data, position) {
        if (StateDataClass == null)
            StateDataClass = DummyStateData;
        if (position == null)
            position = -1;
        this.process = StateDataClass.name;
        this.position = position;
        this.data = new StateDataClass(data);
    }
    return State;
}());
exports.State = State;
var StateData = /** @class */ (function () {
    function StateData() {
    }
    StateData.prototype.type = function (event) {
        return event;
    };
    StateData.prototype.apply = function (events) {
        if (!(events instanceof Array))
            events = [events];
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var event_1 = events_1[_i];
            if (!(event_1.type in this))
                continue;
            var typedEvent = this.type(event_1);
            this[event_1.type](typedEvent);
        }
    };
    StateData.prototype.toString = function () {
        return this.id;
    };
    return StateData;
}());
exports.StateData = StateData;
var DummyStateData = /** @class */ (function (_super) {
    __extends(DummyStateData, _super);
    function DummyStateData() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return DummyStateData;
}(StateData));
