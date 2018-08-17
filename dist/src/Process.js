"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const Service_1 = require("./Service");
const yaml = require('js-yaml');
const extendify = require('extendify');
const CLArgs = require('command-line-args');
var ActionTypes;
(function (ActionTypes) {
    ActionTypes[ActionTypes["LoadMainConfig"] = 0] = "LoadMainConfig";
    ActionTypes[ActionTypes["SetConfig"] = 1] = "SetConfig";
    ActionTypes[ActionTypes["RegisterService"] = 2] = "RegisterService";
})(ActionTypes || (ActionTypes = {}));
;
;
class Process extends Service_1.Service {
    static nameOf(path) {
        try {
            return path.split('/').pop().replace(/^(.+?)\.[a-z]+$/, '$1');
        }
        catch (e) {
            return 'BhivProcess';
        }
    }
    constructor() {
        super({});
        this.name = Process.nameOf(process.env.pm_exec_path || process.argv[1]);
        this.argv = CLArgs({ name: 'rootpath' }, { partial: true });
        this.rootpath = this.argv.rootpath || process.cwd();
        this.loading = [];
        this.services = new Map();
        this.loadConstant();
        process.on('uncaughtException', (error) => this.logger.error('exception', error.stack || error));
        process.on('unhandledRejection', (error) => this.logger.error('reject', error.stack || error));
        this.loading.push({ type: ActionTypes.LoadMainConfig, payload: this.rootpath });
    }
    loadConstant() {
        const environmentsAliases = { dev: 'development', prod: 'production' };
        const environRaw = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown').toLowerCase();
        const environ = environmentsAliases[environRaw] || environRaw;
        if (environ == 'unknown')
            this.logger.warn('Unknown environment type (e.g. developement, staging, production)');
        process.env.NODE_ENV = environ;
        this.hostname = os_1.hostname();
        this.launcher = process.stdin.isTTY ? 'console' : 'daemon';
        this.environment = environ;
    }
    setConfig(config) {
        this.loading.push({ type: ActionTypes.SetConfig, payload: config });
    }
    registerService(Module) {
        this.loading.push({ type: ActionTypes.RegisterService, payload: Module });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.loading.length > 0)
                yield this.nextTick();
        });
    }
    nextTick() {
        return __awaiter(this, void 0, void 0, function* () {
            const task = this.loading.shift();
            switch (task.type) {
                case ActionTypes.LoadMainConfig: return this.loadMainConfig(task.payload);
                case ActionTypes.SetConfig: return this.loadCustomConfig(task.payload);
                case ActionTypes.RegisterService: return this.loadService(task.payload);
            }
        });
    }
    getConfigFileList() {
        const list = ['config.yml'];
        list.push('config-env-' + this.environment + '.yml');
        list.push('config-host-' + this.hostname + '.yml');
        list.push('config-mode-' + this.launcher + '.yml');
        return list;
    }
    getConfig(directory) {
        return __awaiter(this, void 0, void 0, function* () {
            const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
            const files = this.getConfigFileList();
            let config = {};
            for (const file of files) {
                const filepath = path_1.join(directory, file);
                const part = yield (() => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((resolve, reject) => {
                        return fs_1.readFile(filepath, (err, content) => {
                            if (err)
                                return resolve({});
                            try {
                                const config = yaml.safeLoad(content.toString());
                                return resolve(config);
                            }
                            catch (e) {
                                this.logger.error('Failed when loading:', filepath);
                                this.logger.error(e);
                                return resolve({});
                            }
                        });
                    });
                }))();
                config = extend(config, part);
            }
            return config;
        });
    }
    loadMainConfig(rootpath) {
        return __awaiter(this, void 0, void 0, function* () {
            const directory = path_1.join(rootpath, 'config');
            this.config = yield this.getConfig(directory);
        });
    }
    loadCustomConfig(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
            this.config = extend(this.config, config);
        });
    }
    getModuleConfig(name, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
            const directory = path_1.join(this.rootpath, 'dist', type, name);
            const moduleConfig = yield this.getConfig(directory);
            const userConfig = this.config[name] || {};
            const config = this.resolve(extend(moduleConfig, userConfig, this.config.$all || {}));
            while ((function resolve(base, node) {
                while ('_' in node) {
                    const layer = base[node._] || {};
                    delete node._;
                    Object.assign(node, layer);
                }
            })(this.config, config))
                ;
            return config;
        });
    }
    resolve(data) {
        JSON.stringify(data, function (key, value) {
            if (typeof value == 'string' && value.substr(0, 2) == '_:')
                this[key] = data[key];
            return value;
        });
        return data;
    }
    loadService(Module) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.getModuleConfig(Module.name, 'Service');
            const instance = new Module(config);
            this.services.set(Module.name, instance);
        });
    }
}
exports.default = Process;
;
//# sourceMappingURL=Process.js.map