"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const State_1 = require("./State");
const Cache = require('caching-map');
class MemoryState extends State_1.State {
    constructor(options) {
        if (options == null)
            options = {};
        if (options.size == null)
            options.size = 100;
        if (options.ttl == null)
            options.ttl = null;
        super(CacheMap, options);
    }
}
exports.MemoryState = MemoryState;
class CacheMap extends State_1.StateData {
    constructor(options) {
        super();
        this.entries = new Cache(options.size);
        this.ttl = options.ttl;
    }
    get(key) {
        return this.entries.get(key);
    }
    set(key, value, options) {
        if (options == null)
            options = { ttl: this.ttl };
        this.entries.set(key, value, options);
    }
    delete(key) {
        this.entries.delete(key);
    }
    apply(events) {
        if (!(events instanceof Array))
            events = [events];
        for (const event of events) {
            const id = event.entityId;
            const data = this.get(id);
            if (data == null)
                continue;
            data.apply(event);
            this.set(id, data);
        }
    }
}
//# sourceMappingURL=MemoryState.js.map