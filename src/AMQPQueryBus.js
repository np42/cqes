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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var Query_1 = require("./Query");
var AMQPBus_1 = require("./AMQPBus");
var AMQPQuery_1 = require("./AMQPQuery");
var uuid = require("uuid");
var AMQPQueryBus = /** @class */ (function (_super) {
    __extends(AMQPQueryBus, _super);
    function AMQPQueryBus(url) {
        var _this = _super.call(this, url) || this;
        _this.id = '~RPC-' + uuid.v1();
        _this.pending = new Map();
        _this.queue = null;
        _this.gcInterval = null;
        return _this;
    }
    AMQPQueryBus.prototype.gc = function () {
        // FIXME write a better algo
        var expired = [];
        var now = Date.now();
        for (var _i = 0, _a = this.pending; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], item = _b[1];
            if (item.expiresAt > now)
                continue;
            expired.push(key);
        }
        for (var _c = 0, expired_1 = expired; _c < expired_1.length; _c++) {
            var key = expired_1[_c];
            this.pending.get(key).reject(new Error('Timed out'));
            this.pending["delete"](key);
        }
    };
    AMQPQueryBus.prototype.listenReply = function () {
        var _this = this;
        this.gcInterval = setInterval(function () { return _this.gc(); }, 1000);
        this.queue = this.consume(this.id, function (reply) { return __awaiter(_this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = this.pending.get(reply.id);
                if (session == null)
                    return [2 /*return*/];
                session[reply.type](reply);
                this.pending["delete"](reply.id);
                return [2 /*return*/];
            });
        }); }, { noAck: true, channel: { prefetch: 100 }, queue: { exclusive: true }, Message: AMQPQuery_1.AMQPInReply });
    };
    //--
    AMQPQueryBus.prototype.serve = function (view, handler) {
        var _this = this;
        var options = { Message: AMQPQuery_1.AMQPInQuery,
            channel: { prefetech: 10 },
            reply: function (channel) { return function (message) { return function (method, content) { return __awaiter(_this, void 0, void 0, function () {
                var options, reply;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options = { correlationId: message.properties.correlationId };
                            reply = method == Query_1.ReplyType.Rejected ? new Query_1.OutReply(content) : new Query_1.OutReply(null, content);
                            return [4 /*yield*/, channel.sendToQueue(message.properties.replyTo, reply.serialize(), options)];
                        case 1:
                            _a.sent();
                            channel.ack(message);
                            return [2 /*return*/];
                    }
                });
            }); }; }; }
        };
        return this.consume(view, handler, options);
    };
    AMQPQueryBus.prototype.query = function (request, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 30; }
        if (this.queue == null)
            this.listenReply();
        var options = { queue: this.id, replyTo: this.id, correlationId: uuid.v4(), persistent: false };
        var promise = new Promise(function (resolve, reject) {
            var session = { expiresAt: Date.now() + (timeout * 1000), resolve: resolve, reject: reject };
            options.expiration = String(timeout * 1000);
            _this.pending.set(options.correlationId, session);
            _this.publish(request.view, request.serialize(), options);
        });
        return promise;
    };
    return AMQPQueryBus;
}(AMQPBus_1.AMQPBus));
exports.AMQPQueryBus = AMQPQueryBus;
