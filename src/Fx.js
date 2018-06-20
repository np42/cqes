"use strict";
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
var Status;
(function (Status) {
    Status[Status["INITIAL"] = 0] = "INITIAL";
    Status[Status["PENDING"] = 1] = "PENDING";
    Status[Status["DISTURBED"] = 2] = "DISTURBED";
    Status[Status["READY"] = 3] = "READY";
})(Status || (Status = {}));
var Fx = /** @class */ (function () {
    function Fx(node, trunk) {
        this.node = node;
        this.trunk = trunk;
        this.status = Fx.Status.INITIAL;
        this.value = null;
        this.retryCount = 0;
        this.retrying = null;
        this.pending = [];
        this.branches = [];
    }
    Fx.create = function (value) {
        var _this = this;
        return new Fx(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, value];
        }); }); });
    };
    Fx.prototype.open = function () {
        var _this = this;
        if (this.status == Fx.Status.PENDING)
            return this;
        this.status = Fx.Status.PENDING;
        (this.trunk instanceof Fx
            ? this.trunk.get()
            : new Promise(function (resolve) { return resolve(_this.trunk); })).then(function (value) { return _this.node(value, _this); })
            .then(function (value) { return _this.fulfill(value); })["catch"](function (error) { return _this.snap(error); });
        return this;
    };
    Fx.prototype.fulfill = function (value) {
        this.status = Fx.Status.READY;
        this.retryCount = 0;
        this.value = value;
        while (this.pending.length > 0)
            this.pending.shift()(value, this);
        for (var _i = 0, _a = this.branches; _i < _a.length; _i++) {
            var branch = _a[_i];
            branch.open();
        }
    };
    Fx.prototype.snap = function (error, action) {
        var _this = this;
        if (action)
            this.pending.push(action);
        this.status = Fx.Status.DISTURBED;
        if (this.retryCount == 0) {
            this.retryCount += 1;
            console.log(error);
            this.retrying = setTimeout(function () { _this.retrying = null; _this.open(); }, 42);
        }
        else if (!(this.trunk instanceof Fx)) {
            if (this.retrying == null) {
                this.retryCount += 1;
                console.log(String(error));
                var delay_1 = Math.min(this.retryCount * this.retryCount * 42, 5000);
                this.retrying = setTimeout(function () { _this.retrying = null; _this.open(); }, delay_1);
            }
        }
        else if (this.retryCount == 1) {
            this.retryCount = -1;
            this.trunk.snap(error);
        }
    };
    Fx.prototype.get = function () {
        var _this = this;
        return new Promise(function (resolve) {
            switch (_this.status) {
                case Fx.Status.INITIAL: _this.open();
                case Fx.Status.PENDING:
                case Fx.Status.DISTURBED: return _this.pending.push(resolve);
                case Fx.Status.READY: return resolve(_this.value);
            }
        });
    };
    Fx.prototype.then = function (node) {
        var _this = this;
        var previous = this.node;
        var next = function (value) { return new Promise(function (resolve, reject) {
            return node(value, _this).then(resolve)["catch"](function (error) { return _this.snap(error); });
        }); };
        this.node = function (value, fx) { return previous(value, fx).then(next); };
        return this;
    };
    Fx.prototype["try"] = function (method) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var action = function (value, fx) { return method(value, fx).then(resolve)["catch"](reject); };
            if (_this.status != Fx.Status.READY)
                return _this.pending.push(action);
            else
                return _this.get().then(function (value) { return action(value, _this); });
        });
    };
    Fx.prototype["do"] = function (method) {
        var _this = this;
        return new Promise(function (resolve) {
            var action = function (value, fx) { return method(value, fx)
                .then(resolve)["catch"](function (error) { return _this.snap(error, action); }); };
            if (_this.status != Fx.Status.READY)
                return _this.pending.push(action);
            else
                return _this.get().then(action);
        });
    };
    Fx.prototype.pipe = function (node) {
        var branch = new Fx(node, this);
        this.branches.push(branch);
        return branch;
    };
    Fx.prototype.close = function () {
        if (!this.trunk)
            return false;
        var offset = this.trunk.branches.indexOf(this);
        if (offset >= 0)
            this.trunk.branches.splice(offset, 1);
        return offset >= 0;
    };
    return Fx;
}());
exports["default"] = Fx;
