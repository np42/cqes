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
const MemoryState_1 = require("./MemoryState");
class EventMemoryState extends MemoryState_1.MemoryState {
    constructor(StateDataClass, bus, options) {
        if (options == null)
            options = {};
        if (options.window == null)
            options.window = 50;
        super(options);
        this.StateDataClass = StateDataClass;
        this.bus = bus;
        this.process = options.process || StateDataClass.name;
        this.window = options.window;
    }
    materialize(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = new this.StateDataClass(key);
            const result = yield this.bus.last(this.process + '-' + key, this.window);
            if (result.length == 0)
                return null;
            data.apply(result);
            return data;
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const value = this.data.get(key);
            if (value != null)
                return value;
            const data = yield this.materialize(key);
            if (data == null)
                return null;
            this.data.set(key, data);
            return data;
        });
    }
}
exports.EventMemoryState = EventMemoryState;
//# sourceMappingURL=EventMemoryState.js.map