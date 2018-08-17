"use strict";
exports.__esModule = true;
var Logger_1 = require("./Logger");
var AMQPCommandBus_1 = require("./AMQPCommandBus");
var AMQPQueryBus_1 = require("./AMQPQueryBus");
var ESBus_1 = require("./ESBus");
var ESBus_2 = require("./ESBus");
var CQESBus = /** @class */ (function () {
    function CQESBus(config, name) {
        if (config === void 0) { config = {}; }
        if (name === void 0) { name = null; }
        this.config = config;
        var ebname = { toString: function () { return name + ':Bus'; } };
        this.logger = new Logger_1["default"](ebname, 'red');
        //--
        this.C = new AMQPCommandBus_1.AMQPCommandBus(config.Commands);
        this.Q = new AMQPQueryBus_1.AMQPQueryBus(config.Queries);
        this.E = new ESBus_1.ESBus(config.Events);
        this.S = new ESBus_2.ESBus(config.States);
    }
    CQESBus.prototype.stop = function () {
        //this.C.stop();
        //this.Q.stop();
        //this.E.stop();
        //this.S.stop();
    };
    return CQESBus;
}());
exports.CQESBus = CQESBus;
