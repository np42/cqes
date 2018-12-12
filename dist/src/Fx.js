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
;
;
;
class Fx {
    constructor(node, options = {}) {
        this.node = node;
        this.status = Status.INITIAL;
        this.name = options.name || Fx.newName();
        this.data = null;
        this.lastParent = null;
        this.retryCount = 0;
        this.retrying = null;
        this.events = null;
        this.pending = [];
        this.branches = new Map();
        this.trunk = options.trunk || null;
        this.nocache = options.nocache || false;
        this.nextRetry = Fx.wrapNextRetry(options.nextRetry);
    }
    static create(data, options = {}) {
        return new Fx(() => __awaiter(this, void 0, void 0, function* () { return data; }), options).open();
    }
    static newName() {
        const name = [];
        while (name.length < 10) {
            const c = Math.floor(Math.random() * (10 + 26 + 26));
            if (c < 10)
                name.push(String.fromCharCode(48 + c));
            else if (c < 36)
                name.push(String.fromCharCode(55 + c));
            else
                name.push(String.fromCharCode(61 + c));
        }
        return name.join('');
    }
    static wrapNextRetry(next) {
        if (typeof next == 'function')
            return next;
        if (next instanceof Array)
            return (count) => next[Math.min(next.length - 1, count - 1)];
        return (count) => Math.min(Math.pow(count, 3) * 42, 15000);
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
    open(propaged = false) {
        if (this.status == Status.READY)
            return this;
        if (this.status == Status.PENDING)
            return this;
        if (this.status == Status.ABORTED) {
            while (this.pending.length > 0) {
                const pendingAction = this.pending.shift();
                if ('reject' in pendingAction)
                    pendingAction.reject('ABORTED');
                else if ('resolve' in pendingAction)
                    pendingAction.resolve(null);
            }
            return this;
        }
        if (propaged)
            this.lastParent = Date.now();
        this.status = Status.PENDING;
        const fulfill = (value) => this.fulfill(value);
        const failWith = (error) => this.failWith(error);
        if (this.trunk == null) {
            this.produce(null).then(fulfill).catch(failWith);
        }
        else {
            this.trunk.value().then(value => this.produce(value).then(fulfill).catch(failWith));
        }
        return this;
    }
    produce(param) {
        return this.node(param, this);
    }
    fulfill(data) {
        if (this.status == Status.ABORTED)
            return;
        this.status = Status.READY;
        this.retryCount = 0;
        this.data = data;
        while (this.pending.length > 0)
            this.pending.shift().action(data, this);
        for (const [name, branch] of this.branches)
            branch.open(true);
        this.emit('ready');
    }
    failWith(error, propaged = false) {
        if (this.status == Status.ABORTED)
            return;
        this.status = Status.DISRUPTED;
        if (this.retryCount == 0) {
            console.log('Fx[' + this.name + '].failWith', 0, error);
            if (error instanceof Error)
                error = String(error);
            this.retryCount += 1;
            const nextRetry = this.nextRetry(this.retryCount);
            this.emit('disrupted', error);
            for (const [name, branch] of this.branches)
                branch.failWith(error, true);
            if (this.bridge)
                this.bridge.failWith(error, true);
            if (nextRetry != null)
                this.retrying = setTimeout(() => { this.retrying = null; this.open(); }, nextRetry);
        }
        else if (!(this.trunk instanceof Fx) || Date.now() < this.lastParent + 60000) {
            if (this.retrying == null) {
                console.log('Fx[' + this.name + ']:', this.retryCount, String(error));
                this.retryCount += 1;
                const nextRetry = this.nextRetry(this.retryCount);
                if (nextRetry != null)
                    this.retrying = setTimeout(() => { this.retrying = null; this.open(); }, nextRetry);
            }
        }
        else if (this.retryCount > 0) {
            this.trunk.failWith(error, true);
        }
    }
    abort() {
        console.log('Fx[' + this.name + '].aborted');
        this.status = Status.ABORTED;
        if (this.retrying != null) {
            clearTimeout(this.retrying);
            this.retrying = null;
            this.retryCount = 0;
        }
        if (this.trunk != null)
            this.trunk.branches.delete(this.name);
        this.emit('disrupted', 'Aborting');
        this.emit('aborted');
        for (const [name, branch] of this.branches)
            branch.abort();
    }
    value() {
        return new Promise((resolve, reject) => {
            if (this.nocache)
                this.status = Status.INITIAL;
            switch (this.status) {
                case Status.INITIAL:
                case Status.PENDING:
                case Status.DISRUPTED:
                    this.pending.push({ action: (data) => __awaiter(this, void 0, void 0, function* () { return resolve(data); }), reject });
                    if (this.status == Status.INITIAL)
                        this.open();
                    return;
                case Status.READY:
                    return resolve(this.data);
                case Status.ABORTED:
                    return reject('ABORTED');
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
    get(name) {
        const branch = this.branches.get(name);
        if (branch == null)
            return Fx.create(null);
        return branch;
    }
    set(branch) {
        const name = branch.name;
        const old = this.branches.get(name);
        if (old)
            old.abort();
        this.branches.set(name, branch);
        return this;
    }
    try(method, count = 1) {
        return new Promise((resolve, reject) => {
            const action = (value, fx) => {
                let error = null;
                let result = null;
                try {
                    result = method(value, fx);
                }
                catch (e) {
                    error = e;
                }
                if (result instanceof Promise) {
                    return result.then(resolve).catch((error) => {
                        if (count > 1)
                            return this.try(method, count - 1).then(resolve).catch(reject);
                        else
                            return reject(error);
                    });
                }
                else if (error) {
                    if (count > 1)
                        return this.try(method, count - 1).then(resolve).catch(reject);
                    else
                        return reject(error);
                }
                else {
                    return resolve(result);
                }
            };
            if (this.status != Status.READY)
                return this.pending.push({ action, reject }), this.open();
            else
                return this.value().then((value) => action(value, this));
        });
    }
    do(method) {
        return new Promise(resolve => {
            const action = (value, fx) => {
                let error = null;
                let result = null;
                try {
                    result = method(value, fx);
                }
                catch (e) {
                    error = e;
                }
                if (result instanceof Promise) {
                    return result.then(resolve).catch((error) => {
                        this.pending.push({ action, resolve });
                        return this.failWith(error);
                    });
                }
                if (error) {
                    this.pending.push({ action, resolve });
                    return this.failWith(error);
                }
                else {
                    return resolve(result);
                }
            };
            if (this.status != Status.READY) {
                this.pending.push({ action, resolve });
                return this.open();
            }
            else {
                return this.value().then((value) => action(value, this));
            }
        });
    }
    pipe(node, options = {}) {
        const branch = new Fx(node, Object.assign({}, options, { trunk: this }));
        this.set(branch);
        if (this.status == Status.READY)
            branch.open();
        return branch;
    }
    merge(node, options = {}) {
        const branch = new FxWrap(node, Object.assign({}, options, { trunk: this }));
        this.set(branch);
        if (this.status == Status.READY)
            branch.open();
        return branch;
    }
}
exports.Fx = Fx;
class FxWrap extends Fx {
    constructor(node, options) {
        super(node, options);
    }
    value() {
        return new Promise(resolve => {
            super.value().then((fx) => fx.value().then(resolve));
        });
    }
    mayValue() {
        if (this.status == Status.INITIAL)
            return new Promise(() => { });
        if (this.status == Status.READY && this.nocache == false)
            return { then: (f) => f(this.data) };
        else
            return super.value();
    }
    produce(value) {
        return new Promise((resolve, reject) => {
            return super.produce(value).then((fx) => {
                if (this.data != null)
                    this.data.abort();
                fx.bridge = this;
                return resolve(fx);
            }).catch(reject);
        });
    }
    failWith(error) {
        this.mayValue().then((fx) => fx.abort());
        super.failWith(error);
    }
    abort() {
        if (this.status == Status.ABORTED)
            return;
        this.mayValue().then((fx) => fx.abort());
        super.abort();
    }
}
exports.FxWrap = FxWrap;
//# sourceMappingURL=Fx.js.map