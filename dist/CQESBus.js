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
const URL = require("url");
const Logger_1 = require("./Logger");
class Bus {
    constructor(config = {}, name = null) {
        this.config = config;
        const ebname = { toString: () => name + ':Bus' };
        this.logger = new Logger_1.default(ebname, 'red');
        this.initCommands(config.Commands);
        this.initQueries(config.Queries);
        this.initEvents(config.Events);
        this.initStates(config.States);
    }
    initCommands(config) {
        debugger;
        let url = config.origin;
        if (config.credentials != null) {
            const username = encodeURIComponent(config.credentials.username);
            const password = encodeURIComponent(config.credentials.password);
            url = URL.format(Object.assign({}, URL.parse(url), { auth: username + ':' + password }));
        }
        console.log(url);
    }
    request(command) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    listen(topicId) {
    }
    initQueries(config) {
    }
    server(endpoint, handler, type) {
    }
    initEvents(config) {
    }
    publish(streamId, events) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    read(streamId, from) {
    }
    subscribe(streamId, from) {
    }
    initStates(config) {
    }
    load(processId) {
    }
    save(processId, versions, data) {
    }
}
exports.Bus = Bus;
//# sourceMappingURL=CQESBus.js.map