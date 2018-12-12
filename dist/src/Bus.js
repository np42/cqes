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
const Logger_1 = require("./Logger");
const AMQPCommandBus_1 = require("./AMQPCommandBus");
const AMQPQueryBus_1 = require("./AMQPQueryBus");
const Command_1 = require("./Command");
const Query_1 = require("./Query");
class Bus {
    constructor(props, children) {
        this.logger = new Logger_1.Logger(props.name + '.Bus', 'white');
        this.commandBus = new AMQPCommandBus_1.AMQPCommandBus(Object.assign({ name: props.name }, props.Command));
        this.queryBus = new AMQPQueryBus_1.AMQPQueryBus(Object.assign({ name: props.name }, props.Query));
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.queryBus.start()) {
                if (yield this.commandBus.start())
                    return true;
                yield this.queryBus.stop();
                return false;
            }
            return false;
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commandBus.stop();
            yield this.queryBus.stop();
        });
    }
    command(key, order, data, meta) {
        this.logger.log('%red %s : %s', 'Command', key, order);
        const outCommand = new Command_1.OutCommand(key, order, data, meta);
        return this.commandBus.request(outCommand);
    }
    listen(topic, handler) {
        return this.commandBus.listen(topic, handler);
    }
    query(view, method, data, meta) {
        this.logger.log('%blue %s -> %s', 'Query', view, method);
        const outQuery = new Query_1.OutQuery(view, method, data, meta);
        return this.queryBus.query(outQuery);
    }
    serve(view, handler) {
        return this.queryBus.serve(view, handler);
    }
}
exports.Bus = Bus;
//# sourceMappingURL=Bus.js.map