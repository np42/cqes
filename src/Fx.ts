enum Status { INITIAL, PENDING, DISTURBED, READY }

export type Node<N, B> = (value: N, fx: Fx<N, B>) => Promise<B>;
export type Action<N, B> = (value: B, fx: Fx<N, B>) => Promise<any>;

export class Fx<N, B> {

  static create(value: any) {
    return new Fx(async () => value);
  }

  private node:       Node<N, B>;
  private trunk:      Fx<any, N>;
  private status:     Status;
  private value:      any;
  private retryCount: number;
  private retrying:   NodeJS.Timer;
  private pending:    Array<Action<N, B>>;
  private branches:   Array<Fx<B, any>>;

  constructor(node: Node<N, B>, trunk?: Fx<any, N>) {
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
    ) .then(value => this.node(<N>value, this))
      .then(value => this.fulfill(value))
      .catch(error => this.snap(error));
    return this;
  }

  fulfill(value: B) {
    this.status     = Status.READY;
    this.retryCount = 0;
    this.value      = value;
    while (this.pending.length > 0)
      this.pending.shift()(value, this);
    for (const branch of this.branches)
      branch.open();
  }

  snap(error: Error, action?: Action<N, B>) {
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

  then(continuity: Node<any, B>) {
    const previous = this.node;
    const next = (value: any): Promise<B> => new Promise((resolve, reject) => {
      return continuity(value, this).then(resolve).catch((error: Error) => this.snap(error));
    });
    this.node = (value, fx) => (<Promise<any>>previous(value, fx)).then(next);
    return this;
  }

  try(method: Action<N, B>) {
    return new Promise((resolve, reject) => {
      const action = (value: B, fx: Fx<N, B>) => method(value, fx).then(resolve).catch(reject);
      if (this.status != Status.READY) return this.pending.push(action);
      else return this.get().then((value: B) => action(value, this));
    });
  }

  do(method: Action<N, B>) {
    return new Promise(resolve => {
      const action = (value: B, fx: Fx<N, B>): Promise<any> => method(value, fx)
        .then(resolve)
        .catch((error: Error) => this.snap(error, action));
      if (this.status != Status.READY) return this.pending.push(action);
      else return this.get().then((value: B) => action(value, this));
    });
  }

  pipe(node: Node<B, any>): Fx<B, any> {
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