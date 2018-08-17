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
var os_1 = require("os");
var fs_1 = require("fs");
var path_1 = require("path");
var yaml = require('js-yaml');
var extendify = require('extendify');
var CLArgs = require('command-line-args');
var Service_1 = require("./Service");
var ActionTypes;
(function (ActionTypes) {
    ActionTypes[ActionTypes["LoadMainConfig"] = 0] = "LoadMainConfig";
    ActionTypes[ActionTypes["SetConfig"] = 1] = "SetConfig";
    ActionTypes[ActionTypes["RegisterService"] = 2] = "RegisterService";
})(ActionTypes || (ActionTypes = {}));
;
;
exports["default"] = new /** @class */ (function (_super) {
    __extends(Process, _super);
    function Process() {
        var _this = _super.call(this, {}) || this;
        _this.name = Process.nameOf(process.env.pm_exec_path || process.argv[1]);
        _this.argv = CLArgs({ name: 'rootpath' }, { partial: true });
        _this.rootpath = _this.argv.rootpath || process.cwd();
        _this.loading = [];
        _this.services = new Map();
        _this.managers = new Map();
        _this.loadConstant();
        process.on('uncaughtException', function (error) { return _this.logger.error('exception', error.stack || error); });
        process.on('unhandledRejection', function (error) { return _this.logger.error('reject', error.stack || error); });
        //--
        _this.loading.push({ type: ActionTypes.LoadMainConfig, payload: _this.rootpath });
        return _this;
    }
    Process.nameOf = function (path) {
        try {
            return path.split('/').pop().replace(/^(.+?)\.[a-z]+$/, '$1');
        }
        catch (e) {
            return 'BhivProcess';
        }
    };
    Process.prototype.loadConstant = function () {
        var environmentsAliases = { dev: 'development', prod: 'production' };
        var environRaw = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown').toLowerCase();
        var environ = environmentsAliases[environRaw] || environRaw;
        if (environ == 'unknown')
            this.logger.warn('Unknown environment type (e.g. developement, staging, production)');
        process.env.NODE_ENV = environ;
        this.hostname = os_1.hostname();
        this.launcher = process.stdin.isTTY ? 'console' : 'daemon';
        this.environment = environ;
    };
    Process.prototype.setConfig = function (config) {
        this.loading.push({ type: ActionTypes.SetConfig, payload: config });
    };
    Process.prototype.registerService = function (Module) {
        this.loading.push({ type: ActionTypes.RegisterService, payload: Module });
    };
    Process.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.loading.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.nextTick()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 0];
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    Process.prototype.nextTick = function () {
        return __awaiter(this, void 0, void 0, function () {
            var task;
            return __generator(this, function (_a) {
                task = this.loading.shift();
                switch (task.type) {
                    case ActionTypes.LoadMainConfig: return [2 /*return*/, this.loadMainConfig(task.payload)];
                    case ActionTypes.SetConfig: return [2 /*return*/, this.loadCustomConfig(task.payload)];
                    case ActionTypes.RegisterService: return [2 /*return*/, this.loadService(task.payload)];
                }
                return [2 /*return*/];
            });
        });
    };
    Process.prototype.getConfigFileList = function () {
        var list = ['config.yml'];
        list.push('config-env-' + this.environment + '.yml');
        list.push('config-host-' + this.hostname + '.yml');
        list.push('config-mode-' + this.launcher + '.yml');
        return list;
    };
    Process.prototype.getConfig = function (directory) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var extend, files, config, _loop_1, _i, files_1, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
                        files = this.getConfigFileList();
                        config = {};
                        _loop_1 = function (file) {
                            var filepath, part;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        filepath = path_1.join(directory, file);
                                        return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                                                var _this = this;
                                                return __generator(this, function (_a) {
                                                    return [2 /*return*/, new Promise(function (resolve, reject) {
                                                            return fs_1.readFile(filepath, function (err, content) {
                                                                if (err)
                                                                    return resolve({});
                                                                try {
                                                                    var config_1 = yaml.safeLoad(content.toString());
                                                                    return resolve(config_1);
                                                                }
                                                                catch (e) {
                                                                    _this.logger.error('Failed when loading:', filepath);
                                                                    _this.logger.error(e);
                                                                    return resolve({});
                                                                }
                                                            });
                                                        })];
                                                });
                                            }); })()];
                                    case 1:
                                        part = _a.sent();
                                        config = extend(config, part);
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, files_1 = files;
                        _a.label = 1;
                    case 1:
                        if (!(_i < files_1.length)) return [3 /*break*/, 4];
                        file = files_1[_i];
                        return [5 /*yield**/, _loop_1(file)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, config];
                }
            });
        });
    };
    Process.prototype.loadMainConfig = function (rootpath) {
        return __awaiter(this, void 0, void 0, function () {
            var directory, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        directory = path_1.join(rootpath, 'config');
                        _a = this;
                        return [4 /*yield*/, this.getConfig(directory)];
                    case 1:
                        _a.config = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Process.prototype.loadCustomConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var extend;
            return __generator(this, function (_a) {
                extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
                this.config = extend(this.config, config);
                return [2 /*return*/];
            });
        });
    };
    Process.prototype.getModuleConfig = function (name, type) {
        return __awaiter(this, void 0, void 0, function () {
            var extend, directory, moduleConfig, userConfig, config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
                        directory = path_1.join(this.rootpath, 'dist', type, name);
                        return [4 /*yield*/, this.getConfig(directory)];
                    case 1:
                        moduleConfig = _a.sent();
                        userConfig = this.config[name] || {};
                        config = this.resolve(extend(moduleConfig, userConfig, this.config.$all || {}));
                        while ((function resolve(base, node) {
                            var altered = false;
                            while ('_' in node) {
                                var layer = base[node._] || {};
                                delete node._;
                                altered = true;
                                Object.assign(node, layer);
                            }
                            for (var key in node) {
                                if (node[key] instanceof Object)
                                    if (resolve(base, node[key]))
                                        altered = true;
                            }
                        })(this.config, config))
                            ;
                        return [2 /*return*/, config];
                }
            });
        });
    };
    Process.prototype.resolve = function (data) {
        JSON.stringify(data, function (key, value) {
            if (typeof value == 'string' && value.substr(0, 2) == '_:')
                this[key] = data[key];
            return value;
        });
        return data;
    };
    Process.prototype.loadService = function (Module) {
        return __awaiter(this, void 0, void 0, function () {
            var config, instance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getModuleConfig(Module.name, 'Service')];
                    case 1:
                        config = _a.sent();
                        instance = new Module(config);
                        this.services.set(Module.name, instance);
                        return [2 /*return*/];
                }
            });
        });
    };
    return Process;
}(Service_1.Service));
