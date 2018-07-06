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
var Status;
(function (Status) {
    Status[Status["INITIAL"] = 0] = "INITIAL";
    Status[Status["PENDING"] = 1] = "PENDING";
    Status[Status["DISRUPTED"] = 2] = "DISRUPTED";
    Status[Status["READY"] = 3] = "READY";
    Status[Status["ABORTED"] = 4] = "ABORTED";
})(Status || (Status = {}));
class Fx {
    constructor(node, options) {
        this.node = node;
        this.trunk = options ? options.trunk : null;
        this.status = Status.INITIAL;
        this.value = null;
        this.retryCount = 0;
        this.retrying = null;
        this.pending = [];
        this.branches = [];
        this.nocache = options ? options.nocache : false;
        this.events = null;
    }
    static create(value) {
        return new Fx(() => __awaiter(this, void 0, void 0, function* () { return value; }));
    }
    on(event, fn) {
        if (this.events == null)
            this.events = new Map();
        if (!this.events.has(event))
            this.events.set(event, [fn]);
        else
            this.events.get(event).push(fn);
        return this;
    }
    one(event, fn) {
        const clear = () => {
            this.off(event, fn);
            this.off(event, clear);
        };
        this.on(event, fn);
        this.on(event, clear);
    }
    off(event, fn) {
        if (this.events == null)
            return this;
        if (!this.events.has(event))
            return this;
        const events = this.events.get(event);
        const offset = events.indexOf(fn);
        if (offset >= 0)
            events.splice(offset, 1);
        if (events.length == 0)
            this.events.delete(event);
        return this;
    }
    emit(event, payload) {
        if (this.events == null)
            return this;
        const events = this.events.get(event);
        if (events == null)
            return this;
        for (const fn of events)
            fn(payload);
        return this;
    }
    open() {
        if (this.status == Status.READY)
            return this;
        if (this.status == Status.PENDING)
            return this;
        this.status = Status.PENDING;
        const fulfill = (value) => this.fulfill(value);
        const failWith = (error) => this.failWith(error);
        if (this.trunk == null) {
            this.produce(null).then(fulfill).catch(failWith);
        }
        else {
            this.trunk.get().then(value => this.produce(value).then(fulfill).catch(failWith));
        }
        return this;
    }
    produce(value) {
        return this.node(value, this);
    }
    fulfill(value) {
        if (this.status == Status.ABORTED)
            return;
        this.status = Status.READY;
        this.retryCount = 0;
        this.value = value;
        while (this.pending.length > 0)
            this.pending.shift()(value, this);
        for (const branch of this.branches)
            branch.open();
        this.emit('ready');
    }
    failWith(error, action) {
        if (this.status == Status.ABORTED)
            return;
        if (action)
            this.pending.push(action);
        this.status = Status.DISRUPTED;
        if (this.retryCount == 0) {
            this.retryCount += 1;
            console.log(error);
            this.emit('disrupted', error);
            for (const branch of this.branches)
                branch.failWith(error);
            if (this.bridge)
                this.bridge.failWith(error);
            this.retrying = setTimeout(() => { this.retrying = null; this.open(); }, 42);
        }
        else if (!(this.trunk instanceof Fx)) {
            if (this.retrying == null) {
                this.retryCount += 1;
                console.log(String(error));
                const delay = Math.min(this.retryCount * this.retryCount * 42, 5000);
                this.retrying = setTimeout(() => { this.retrying = null; this.open(); }, delay);
            }
        }
        else if (this.retryCount == 1) {
            this.retryCount = -1;
            this.trunk.failWith(error);
        }
    }
    abort() {
        this.status = Status.ABORTED;
        if (this.retrying != null) {
            clearTimeout(this.retrying);
            this.retrying = null;
            this.retryCount = 0;
        }
        if (this.trunk != null) {
            const offset = this.trunk.branches.indexOf(this);
            if (offset >= 0)
                this.trunk.branches.splice(offset, 1);
        }
        this.emit('disrupted', 'Aborting');
        this.emit('aborted');
        for (const branch of this.branches)
            branch.abort();
    }
    get() {
        return new Promise((resolve, reject) => {
            if (this.nocache)
                this.status = Status.INITIAL;
            switch (this.status) {
                case Status.INITIAL:
                case Status.PENDING:
                case Status.DISRUPTED:
                    this.pending.push((value) => __awaiter(this, void 0, void 0, function* () { return resolve(value); }));
                    if (this.status == Status.INITIAL)
                        this.open();
                    return;
                case Status.READY:
                    return resolve(this.value);
                case Status.ABORTED:
                    return reject('CANNOT_GET_ABORTED');
            }
        });
    }
    and(continuity) {
        const previous = this.node;
        const next = (value) => new Promise((resolve, reject) => {
            const promise = continuity(value, this);
            return promise.then(resolve).catch((error) => this.failWith(error));
        });
        this.node = (value, fx) => previous(value, fx).then(next);
        return this;
    }
    try(method) {
        return new Promise((resolve, reject) => {
            const action = (value, fx) => method(value, fx).then(resolve).catch(reject);
            if (this.status != Status.READY)
                return this.pending.push(action), this.open();
            else
                return this.get().then((value) => action(value, this));
        });
    }
    do(method) {
        return new Promise(resolve => {
            const action = (value, fx) => method(value, fx)
                .then(resolve)
                .catch((error) => this.failWith(error, action));
            if (this.status != Status.READY)
                return this.pending.push(action), this.open();
            else
                return this.get().then((value) => action(value, this));
        });
    }
    pipe(node) {
        const branch = new Fx(node, { trunk: this });
        this.branches.push(branch);
        return branch;
    }
    merge(node) {
        const branch = new FxWrap(node, { trunk: this });
        this.branches.push(branch);
        return branch;
    }
}
exports.Fx = Fx;
class FxWrap extends Fx {
    constructor(node, options) {
        super(node, options);
    }
    get() {
        return new Promise(resolve => {
            super.get().then((fx) => fx.get().then(resolve));
        });
    }
    mayGet() {
        if (this.status == Status.INITIAL)
            return new Promise(() => { });
        return super.get();
    }
    produce(value) {
        return new Promise((resolve, reject) => {
            return super.produce(value).then((fx) => {
                if (this.value != null)
                    this.value.abort();
                fx.bridge = this;
                return resolve(fx);
            }).catch(reject);
        });
    }
    failWith(error) {
        this.mayGet().then((fx) => fx.abort());
        super.failWith(error);
    }
    abort() {
        this.mayGet().then((fx) => fx.abort());
        super.abort();
    }
}
exports.FxWrap = FxWrap;
//# sourceMappingURL=Fx.js.map