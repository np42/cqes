"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Component = require("./Component");
const Reply_1 = require("./Reply");
class Responder extends Component.Component {
    constructor(props, children) {
        super(Object.assign({ type: 'Responder' }, props), children);
    }
    responde(command, state, events) {
        let method = null;
        let result = null;
        const shortMethod = 'responde' + command.order;
        if (shortMethod in this) {
            try {
                result = this[shortMethod](command, state, events);
            }
            catch (e) {
                return new Reply_1.Reply(String(e));
            }
            method = shortMethod;
        }
        else {
            for (const event of events) {
                const longMethod = shortMethod + 'When' + event.name;
                if (!(longMethod in this))
                    continue;
                try {
                    result = this[longMethod](command, state, event);
                }
                catch (e) {
                    return new Reply_1.Reply(String(e));
                }
                method = longMethod;
                break;
            }
        }
        if (result instanceof Reply_1.Reply) {
            this.logger.log("Resolved %s by %s => %j", command.key, method, result.data);
            return result;
        }
        else if (result != null) {
            this.logger.log("Resolved %s by %s => %j", command.key, method, result);
            return new Reply_1.Reply(null, result);
        }
        else if (method != null) {
            this.logger.log('No resolution for %s : %s', command.key, command.order);
            return new Reply_1.Reply(null, null);
        }
        else {
            return new Reply_1.Reply(null, null);
        }
    }
}
exports.Responder = Responder;
//# sourceMappingURL=Responder.js.map