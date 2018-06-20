enum Status { INITIAL, PENDING, DISTURBED, READY }

type Handler<T, C> = (value: T, fx: Fx<T, C>) => Promise<C>;
type Action<T, C> = (value: C, fx: Fx<T, C>) => Promise<any>;

export class Fx<T, C> {

  static create(value: any) {
    return new Fx(async () => value);
  }

  private node:       Handler<T, C>;
  private trunk:      Fx<any, T>;
  private status:     Status;
  private value:      any;
  private retryCount: number;
  private retrying:   NodeJS.Timer;
  private pending:    Array<Action<T, C>>;
  private branches:   Array<Fx<C, any>>;

  constructor(node: Handler<T, C>, trunk?: Fx<any, T>) {
    this.node        = node;
    this.trunk       = trunk;
    this.status      = Status.INITIAL;
    this.value       = null;
    this.retryCount  = 0;
    this.retrying    = null;
    this.pending     = [];
    this.branches    = [];
  }

  open() {
    if (this.status == Status.PENDING) return this;
    this.status   = Status.PENDING;
    ( this.trunk instanceof Fx
      ? this.trunk.get()
      : new Promise(resolve => resolve(this.trunk))
    ) .then(value => this.node(<T>value, this))
      .then(value => this.fulfill(value))
      .catch(error => this.snap(error));
    return this;
  }

  fulfill(value: C) {
    this.status     = Status.READY;
    this.retryCount = 0;
    this.value      = value;
    while (this.pending.length > 0)
      this.pending.shift()(value, this);
    for (const branch of this.branches)
      branch.open();
  }

  snap(error: Error, action?: Action<T, C>) {
    if (action) this.pending.push(action);
    this.status = Status.DISTURBED;
    if (this.retryCount == 0) {
      this.retryCount += 1;
      console.log(error);
      this.retrying = setTimeout(() => { this.retrying = null; this.open() }, 42);
    } else if (!(this.trunk instanceof Fx)) {
      if (this.retrying == null) {
        this.retryCount += 1;
        console.log(String(error));
        const delay = Math.min(this.retryCount * this.retryCount * 42, 5000);
        this.retrying = setTimeout(() => { this.retrying = null; this.open() }, delay);
      }
    } else if (this.retryCount == 1) {
      this.retryCount = -1;
      this.trunk.snap(error);
    }
  }

  get() {
    return new Promise(resolve => {
      switch (this.status) {
      case Status.INITIAL: this.open();
      case Status.PENDING:
      case Status.DISTURBED: return this.pending.push(async value => resolve(value));
      case Status.READY: return resolve(this.value);
      }
    });
  }

  then(continuity: Handler<any, C>) {
    const previous = this.node;
    const next = (value: any): Promise<C> => new Promise((resolve, reject) => {
      return continuity(value, this).then(resolve).catch((error: Error) => this.snap(error));
    });
    this.node = (value, fx) => (<Promise<any>>previous(value, fx)).then(next);
    return this;
  }

  try(method: Action<T, C>) {
    return new Promise((resolve, reject) => {
      const action = (value: C, fx: Fx<T, C>) => method(value, fx).then(resolve).catch(reject);
      if (this.status != Status.READY) return this.pending.push(action);
      else return this.get().then((value: C) => action(value, this));
    });
  }

  do(method: Action<T, C>) {
    return new Promise(resolve => {
      const action = (value: C, fx: Fx<T, C>): Promise<any> => method(value, fx)
        .then(resolve)
        .catch((error: Error) => this.snap(error, action));
      if (this.status != Status.READY) return this.pending.push(action);
      else return this.get().then((value: C) => action(value, this));
    });
  }

  pipe(node: Handler<C, any>): Fx<C, any> {
    const branch = new Fx(node, this);
    this.branches.push(branch);
    return branch;
  }

  close() {
    if (!this.trunk) return false;
    const offset = this.trunk.branches.indexOf(this);
    if (offset >= 0) this.trunk.branches.splice(offset, 1);
    return offset >= 0;
  }

}