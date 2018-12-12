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
const Component = require("./Component");
const Bus = require("./Bus");
const Debouncer = require("./Debouncer");
const Throttler = require("./Throttler");
const Gateway = require("./Gateway");
const Aggregator = require("./Aggregator");
class Service extends Component.Component {
    constructor(props, children) {
        const color = props.type == 'Aggregator' ? 'green' : 'yellow';
        super(Object.assign({ type: 'Service', color }, props), children);
        this.bus = this.sprout('Bus', Bus);
        this.debouncer = this.sprout('Debouncer', Debouncer);
        this.throttler = this.sprout('Throttler', Throttler);
        switch (props.type) {
            case 'Gateway':
                {
                    this.handler = this.sprout('Gateway', Gateway);
                }
                ;
                break;
            case 'Aggregator':
                {
                    this.handler = this.sprout('Aggregator', Aggregator);
                }
                ;
                break;
        }
        if (this.handler.start == null)
            this.logger.error('Missing .start method');
        if (this.handler.stop == null)
            this.logger.error('Missing .stop method');
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.handler.start()) {
                const handlerProps = Object.getOwnPropertyNames(this.handler.constructor.prototype);
                const hasHandleMethod = handlerProps.filter(m => /^handle([A-Z]|$)/.test(m)).length > 0;
                if (hasHandleMethod) {
                    this.logger.log('Listening %s.Command', this.props.name);
                    this.bus.listen(this.props.name, (command) => __awaiter(this, void 0, void 0, function* () {
                        this.debouncer.satisfy(command, command => {
                            if ('handle' in this.handler)
                                return this.handler.handle(command);
                            const method = 'handle' + command.order;
                            if (method in this.handler)
                                return this.handler[method](command);
                            return Promise.resolve(null);
                        });
                    }));
                }
                const hasResolveMethod = handlerProps.filter(m => /^resolve([A-Z]|$)/.test(m)).length > 0;
                if (hasResolveMethod) {
                    this.logger.log('Serving %s.Query', this.props.name);
                    this.bus.serve(this.props.name, (query) => __awaiter(this, void 0, void 0, function* () {
                        this.throttler.satisfy(query, query => {
                            if ('resolve' in this.handler)
                                return this.handler.resolve(query);
                            const method = 'resolve' + query.method;
                            if (method in this.handler)
                                return this.handler[method](query);
                            return Promise.resolve(null);
                        });
                    }));
                }
                return this.bus.start();
            }
            else {
                return false;
            }
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.handler.stop();
            yield this.bus.stop();
        });
    }
}
exports.Service = Service;
//# sourceMappingURL=Service.js.map