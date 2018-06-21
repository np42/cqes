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
    Status[Status["DISTURBED"] = 2] = "DISTURBED";
    Status[Status["READY"] = 3] = "READY";
})(Status || (Status = {}));
class Fx {
    constructor(node, trunk) {
        this.node = node;
        this.trunk = trunk;
        this.status = Status.INITIAL;
        this.value = null;
        this.retryCount = 0;
        this.retrying = null;
        this.pending = [];
        this.branches = [];
    }
    static create(value) {
        return new Fx(() => __awaiter(this, void 0, void 0, function* () { return value; }));
    }
    open() {
        if (this.status == Status.PENDING)
            return this;
        this.status = Status.PENDING;
        (this.trunk instanceof Fx
            ? this.trunk.get()
            : new Promise(resolve => resolve(this.trunk))).then(value => this.node(value, this))
            .then(value => this.fulfill(value))
            .catch(error => this.snap(error));
        return this;
    }
    fulfill(value) {
        this.status = Status.READY;
        this.retryCount = 0;
        this.value = value;
        while (this.pending.length > 0)
            this.pending.shift()(value, this);
        for (const branch of this.branches)
            branch.open();
    }
    snap(error, action) {
        if (action)
            this.pending.push(action);
        this.status = Status.DISTURBED;
        if (this.retryCount == 0) {
            this.retryCount += 1;
            console.log(error);
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
            this.trunk.snap(error);
        }
    }
    get() {
        return new Promise(resolve => {
            switch (this.status) {
                case Status.INITIAL: this.open();
                case Status.PENDING:
                case Status.DISTURBED: return this.pending.push((value) => __awaiter(this, void 0, void 0, function* () { return resolve(value); }));
                case Status.READY: return resolve(this.value);
            }
        });
    }
    then(continuity) {
        const previous = this.node;
        const next = (value) => new Promise((resolve, reject) => {
            return continuity(value, this).then(resolve).catch((error) => this.snap(error));
        });
        this.node = (value, fx) => previous(value, fx).then(next);
        return this;
    }
    try(method) {
        return new Promise((resolve, reject) => {
            const action = (value, fx) => method(value, fx).then(resolve).catch(reject);
            if (this.status != Status.READY)
                return this.pending.push(action);
            else
                return this.get().then((value) => action(value, this));
        });
    }
    do(method) {
        return new Promise(resolve => {
            const action = (value, fx) => method(value, fx)
                .then(resolve)
                .catch((error) => this.snap(error, action));
            if (this.status != Status.READY)
                return this.pending.push(action);
            else
                return this.get().then((value) => action(value, this));
        });
    }
    pipe(node) {
        const branch = new Fx(node, this);
        this.branches.push(branch);
        return branch;
    }
    close() {
        if (!this.trunk)
            return false;
        const offset = this.trunk.branches.indexOf(this);
        if (offset >= 0)
            this.trunk.branches.splice(offset, 1);
        return offset >= 0;
    }
}
exports.Fx = Fx;
//# sourceMappingURL=Fx.js.map