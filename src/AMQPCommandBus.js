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
var AMQPBus_1 = require("./AMQPBus");
var AMQPCommandBus = /** @class */ (function (_super) {
    __extends(AMQPCommandBus, _super);
    function AMQPCommandBus(url) {
        return _super.call(this, url) || this;
    }
    AMQPCommandBus.prototype.listen = function (topic, handler) {
        var options = { channel: { prefetch: 10 } };
        return this.consume(topic, handler, options);
    };
    AMQPCommandBus.prototype.command = function (request) {
        var options = { persistent: true };
        return this.publish(request.topic, request.serialize(), options);
    };
    return AMQPCommandBus;
}(AMQPBus_1.AMQPBus));
exports.AMQPCommandBus = AMQPCommandBus;
