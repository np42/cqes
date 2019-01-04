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
const Reply_1 = require("./Reply");
const CachingMap = require('caching-map');
class Debouncer extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Debouncer', color: 'magenta' }, props), children);
        this.waiting = new CachingMap(props.size >= 0 ? props.size : null);
        this.ttl = props.ttl >= 0 ? props.ttl : null;
    }
    satisfy(command, handler) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('%red %s : %s %j', 'Command', command.key, command.order, command.data);
            try {
                const reply = yield handler(command);
                if (reply instanceof Reply_1.Reply)
                    return command[reply.status](reply.data);
                this.logger.warn('Expecting a Reply got: %j', reply);
                command.reject(null);
            }
            catch (e) {
                this.logger.error(e);
                command.reject(e);
            }
        });
    }
}
exports.Debouncer = Debouncer;
//# sourceMappingURL=Debouncer.js.map