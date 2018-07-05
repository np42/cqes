"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
const AMQPCommandBus_1 = require("./AMQPCommandBus");
const AMQPQueryBus_1 = require("./AMQPQueryBus");
const ESBus_1 = require("./ESBus");
const ESBus_2 = require("./ESBus");
class CQESBus {
    constructor(config = {}, name = null) {
        this.config = config;
        const ebname = { toString: () => name + ':Bus' };
        this.logger = new Logger_1.default(ebname, 'red');
        this.C = new AMQPCommandBus_1.AMQPCommandBus(config.Commands);
        this.Q = new AMQPQueryBus_1.AMQPQueryBus(config.Queries);
        this.E = new ESBus_1.ESBus(config.Events);
        this.S = new ESBus_2.ESBus(config.States);
    }
}
exports.CQESBus = CQESBus;
//# sourceMappingURL=CQESBus.js.map