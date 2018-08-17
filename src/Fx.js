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
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
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
    Status[Status["DISRUPTED"] = 2] = "DISRUPTED";
    Status[Status["READY"] = 3] = "READY";
    Status[Status["ABORTED"] = 4] = "ABORTED";
})(Status || (Status = {}));
;
;
;
var Fx = /** @class */ (function () {
    function Fx(node, options) {
        if (options === void 0) { options = {}; }
        this.node = node;
        this.status = Status.INITIAL;
        this.name = options.name || Fx.newName();
        this.data = null;
        this.lastParent = null;
        this.retryCount = 0;
        this.retrying = null;
        this.events = null;
        this.pending = [];
        this.branches = new Map();
        this.trunk = options.trunk || null;
        this.nocache = options.nocache || false;
        this.nextRetry = Fx.wrapNextRetry(options.nextRetry);
    }
    Fx.create = function (data, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return new Fx(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, data];
        }); }); }, options).open();
    };
    Fx.newName = function () {
        var name = [];
        while (name.length < 10) {
            var c = Math.floor(Math.random() * (10 + 26 + 26));
            if (c < 10)
                name.push(String.fromCharCode(48 + c));
            else if (c < 36)
                name.push(String.fromCharCode(55 + c));
            else
                name.push(String.fromCharCode(61 + c));
        }
        return name.join('');
    };
    Fx.wrapNextRetry = function (next) {
        if (typeof next == 'function')
            return next;
        if (next instanceof Array)
            return function (count) { return next[Math.min(next.length - 1, count - 1)]; };
        return function (count) { return Math.min(Math.pow(count, 3) * 42, 15000); };
    };
    //-------
    Fx.prototype.on = function (event, fn) {
        if (this.events == null)
            this.events = new Map();
        if (!this.events.has(event))
            this.events.set(event, [fn]);
        else
            this.events.get(event).push(fn);
        return this;
    };
    Fx.prototype.one = function (event, fn) {
        var _this = this;
        var clear = function () {
            _this.off(event, fn);
            _this.off(event, clear);
        };
        this.on(event, fn);
        this.on(event, clear);
    };
    Fx.prototype.off = function (event, fn) {
        if (this.events == null)
            return this;
        if (!this.events.has(event))
            return this;
        var events = this.events.get(event);
        var offset = events.indexOf(fn);
        if (offset >= 0)
            events.splice(offset, 1);
        if (events.length == 0)
            this.events["delete"](event);
        return this;
    };
    Fx.prototype.emit = function (event, payload) {
        if (this.events == null)
            return this;
        var events = this.events.get(event);
        if (events == null)
            return this;
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var fn = events_1[_i];
            fn(payload);
        }
        return this;
    };
    //-------
    Fx.prototype.open = function (propaged) {
        var _this = this;
        if (propaged === void 0) { propaged = false; }
        if (this.status == Status.READY)
            return this;
        if (this.status == Status.PENDING)
            return this;
        if (this.status == Status.ABORTED) {
            while (this.pending.length > 0) {
                var pendingAction = this.pending.shift();
                if ('reject' in pendingAction)
                    pendingAction.reject('ABORTED');
                else if ('resolve' in pendingAction)
                    pendingAction.resolve(null);
            }
            return this;
        }
        if (propaged)
            this.lastParent = Date.now();
        this.status = Status.PENDING;
        var fulfill = function (value) { return _this.fulfill(value); };
        var failWith = function (error) { return _this.failWith(error); };
        if (this.trunk == null) {
            this.produce(null).then(fulfill)["catch"](failWith);
        }
        else {
            this.trunk.value().then(function (value) { return _this.produce(value).then(fulfill)["catch"](failWith); });
        }
        return this;
    };
    Fx.prototype.produce = function (param) {
        return this.node(param, this);
    };
    Fx.prototype.fulfill = function (data) {
        if (this.status == Status.ABORTED)
            return;
        this.status = Status.READY;
        this.retryCount = 0;
        this.data = data;
        while (this.pending.length > 0)
            this.pending.shift().action(data, this);
        for (var _i = 0, _a = this.branches; _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], branch = _b[1];
            branch.open(true);
        }
        this.emit('ready');
    };
    Fx.prototype.failWith = function (error, propaged) {
        var _this = this;
        if (propaged === void 0) { propaged = false; }
        if (this.status == Status.ABORTED)
            return;
        this.status = Status.DISRUPTED;
        if (this.retryCount == 0) {
            console.log('Fx[' + this.name + '].failWith', 0, error);
            if (error instanceof Error)
                error = String(error);
            this.retryCount += 1;
            var nextRetry = this.nextRetry(this.retryCount);
            this.emit('disrupted', error);
            for (var _i = 0, _a = this.branches; _i < _a.length; _i++) {
                var _b = _a[_i], name_2 = _b[0], branch = _b[1];
                branch.failWith(error, true);
            }
            if (this.bridge)
                this.bridge.failWith(error, true);
            if (nextRetry != null)
                this.retrying = setTimeout(function () { _this.retrying = null; _this.open(); }, nextRetry);
        }
        else if (!(this.trunk instanceof Fx) || Date.now() < this.lastParent + 60000) {
            if (this.retrying == null) {
                console.log('Fx[' + this.name + ']:', this.retryCount, String(error));
                this.retryCount += 1;
                var nextRetry = this.nextRetry(this.retryCount);
                if (nextRetry != null)
                    this.retrying = setTimeout(function () { _this.retrying = null; _this.open(); }, nextRetry);
            }
        }
        else if (this.retryCount > 0) {
            this.trunk.failWith(error, true);
        }
    };
    Fx.prototype.abort = function () {
        console.log('Fx[' + this.name + '].aborted');
        this.status = Status.ABORTED;
        if (this.retrying != null) {
            clearTimeout(this.retrying);
            this.retrying = null;
            this.retryCount = 0;
        }
        if (this.trunk != null)
            this.trunk.branches["delete"](this.name);
        this.emit('disrupted', 'Aborting');
        this.emit('aborted');
        for (var _i = 0, _a = this.branches; _i < _a.length; _i++) {
            var _b = _a[_i], name_3 = _b[0], branch = _b[1];
            branch.abort();
        }
    };
    Fx.prototype.value = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.nocache)
                _this.status = Status.INITIAL;
            switch (_this.status) {
                case Status.INITIAL:
                case Status.PENDING:
                case Status.DISRUPTED:
                    _this.pending.push({ action: function (data) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, resolve(data)];
                        }); }); }, reject: reject });
                    if (_this.status == Status.INITIAL)
                        _this.open();
                    return;
                case Status.READY:
                    return resolve(_this.data);
                case Status.ABORTED:
                    return reject('ABORTED');
            }
        });
    };
    Fx.prototype.and = function (continuity) {
        var _this = this;
        var previous = this.node;
        var next = function (value) { return new Promise(function (resolve, reject) {
            var promise = continuity(value, _this);
            return promise.then(resolve)["catch"](function (error) { return _this.failWith(error); });
        }); };
        this.node = function (value, fx) { return previous(value, fx).then(next); };
        return this;
    };
    //
    Fx.prototype.get = function (name) {
        var branch = this.branches.get(name);
        if (branch == null)
            return Fx.create(null);
        return branch;
    };
    Fx.prototype.set = function (branch) {
        var name = branch.name;
        var old = this.branches.get(name);
        if (old)
            old.abort();
        this.branches.set(name, branch);
        return this;
    };
    //
    Fx.prototype["try"] = function (method, count) {
        var _this = this;
        if (count === void 0) { count = 1; }
        return new Promise(function (resolve, reject) {
            var action = function (value, fx) {
                var error = null;
                var result = null;
                try {
                    result = method(value, fx);
                }
                catch (e) {
                    error = e;
                }
                if (result instanceof Promise) {
                    return result.then(resolve)["catch"](function (error) {
                        if (count > 1)
                            return _this["try"](method, count - 1).then(resolve)["catch"](reject);
                        else
                            return reject(error);
                    });
                }
                else if (error) {
                    if (count > 1)
                        return _this["try"](method, count - 1).then(resolve)["catch"](reject);
                    else
                        return reject(error);
                }
                else {
                    return resolve(result);
                }
            };
            if (_this.status != Status.READY)
                return _this.pending.push({ action: action, reject: reject }), _this.open();
            else
                return _this.value().then(function (value) { return action(value, _this); });
        });
    };
    Fx.prototype["do"] = function (method) {
        var _this = this;
        return new Promise(function (resolve) {
            var action = function (value, fx) {
                var error = null;
                var result = null;
                try {
                    result = method(value, fx);
                }
                catch (e) {
                    error = e;
                }
                if (result instanceof Promise) {
                    return result.then(resolve)["catch"](function (error) {
                        _this.pending.push({ action: action, resolve: resolve });
                        return _this.failWith(error);
                    });
                }
                if (error) {
                    _this.pending.push({ action: action, resolve: resolve });
                    return _this.failWith(error);
                }
                else {
                    return resolve(result);
                }
            };
            if (_this.status != Status.READY) {
                _this.pending.push({ action: action, resolve: resolve });
                return _this.open();
            }
            else {
                return _this.value().then(function (value) { return action(value, _this); });
            }
        });
    };
    //
    Fx.prototype.pipe = function (node, options) {
        if (options === void 0) { options = {}; }
        var branch = new Fx(node, __assign({}, options, { trunk: this }));
        this.set(branch);
        if (this.status == Status.READY)
            branch.open();
        return branch;
    };
    Fx.prototype.merge = function (node, options) {
        if (options === void 0) { options = {}; }
        var branch = new FxWrap(node, __assign({}, options, { trunk: this }));
        this.set(branch);
        if (this.status == Status.READY)
            branch.open();
        return branch;
    };
    return Fx;
}());
exports.Fx = Fx;
var FxWrap = /** @class */ (function (_super) {
    __extends(FxWrap, _super);
    function FxWrap(node, options) {
        return _super.call(this, node, options) || this;
    }
    FxWrap.prototype.value = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _super.prototype.value.call(_this).then(function (fx) { return fx.value().then(resolve); });
        });
    };
    FxWrap.prototype.mayValue = function () {
        var _this = this;
        if (this.status == Status.INITIAL)
            return new Promise(function () { });
        if (this.status == Status.READY && this.nocache == false)
            return { then: function (f) { return f(_this.data); } };
        else
            return _super.prototype.value.call(this);
    };
    FxWrap.prototype.produce = function (value) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _super.prototype.produce.call(_this, value).then(function (fx) {
                if (_this.data != null)
                    _this.data.abort();
                fx.bridge = _this;
                return resolve(fx);
            })["catch"](reject);
        });
    };
    FxWrap.prototype.failWith = function (error) {
        this.mayValue().then(function (fx) { return fx.abort(); });
        _super.prototype.failWith.call(this, error);
    };
    FxWrap.prototype.abort = function () {
        if (this.status == Status.ABORTED)
            return;
        this.mayValue().then(function (fx) { return fx.abort(); });
        _super.prototype.abort.call(this);
    };
    return FxWrap;
}(Fx));
exports.FxWrap = FxWrap;
