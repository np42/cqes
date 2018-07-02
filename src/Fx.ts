enum Status { INITIAL, PENDING, DISTURBED, READY }

export type Node<N, B> = (value: N, fx: Fx<N, B>)   => Promise<B>;
export type Action<N, B> = (value: B, fx: Fx<N, B>) => Promise<any>;
export type Options = { nocache: boolean };

export class Fx<N, B> {

  static create(value: any) {
    return new Fx(async () => value);
  }

  private node:       Node<N, B>;
  private trunk:      Fx<any, N>;
  private status:     Status;
  private value:      B;
  private retryCount: number;
  private retrying:   NodeJS.Timer;
  private pending:    Array<Action<N, B>>;
  private branches:   Array<Fx<B, any>>;
  private nocache:    boolean;

  constructor(node: Node<N, B>, trunk?: Fx<any, N>, options?: Options) {
    this.node        = node;
    this.trunk       = trunk;
    this.status      = Status.INITIAL;
    this.value       = null;
    this.retryCount  = 0;
    this.retrying    = null;
    this.pending     = [];
    this.branches    = [];
    this.nocache     = options ? options.nocache : false;
  }

  open() {
    if (this.status == Status.READY)   return this;
    if (this.status == Status.PENDING) return this;
    this.status   = Status.PENDING;
    const fulfill  = (value: B) => this.fulfill(value);
    const failWith = (error: Error) => this.failWith(error);
    if (this.trunk == null) {
      this.node(null, this).then(fulfill).catch(failWith);
    } else {
      this.trunk.get()
        .then(value => this.node(value, this).then(fulfill).catch(failWith));
    }
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

  failWith(error: Error, action?: Action<N, B>) {
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
      this.trunk.failWith(error);
    }
  }

  get(): Promise<B> {
    return new Promise(resolve => {
      if (this.nocache) return this.status = Status.INITIAL;
      switch (this.status) {
      case Status.INITIAL: case Status.PENDING: case Status.DISTURBED:
        this.pending.push(async value => resolve(value));
        if (this.status == Status.INITIAL) this.open();
        return ;
      case Status.READY:
        return resolve(this.value);
      }
    });
  }

  and(continuity: Node<any, B>) {
    const previous = this.node;
    const next = (value: any): Promise<B> => new Promise((resolve, reject) => {
      const promise = continuity(value, this);
      if (promise == null || promise.then == null) debugger;
      return promise.then(resolve).catch((error: Error) => this.failWith(error));
    });
    this.node = (value, fx) => (<Promise<any>>previous(value, fx)).then(next);
    return this;
  }

  try(method: Action<N, B>) {
    return new Promise((resolve, reject) => {
      const action = (value: B, fx: Fx<N, B>) => method(value, fx).then(resolve).catch(reject);
      if (this.status != Status.READY) return this.pending.push(action), this.open();
      else return this.get().then((value: B) => action(value, this));
    });
  }

  do(method: Action<N, B>) {
    return new Promise(resolve => {
      const action = (value: B, fx: Fx<N, B>): Promise<any> => method(value, fx)
        .then(resolve)
        .catch((error: Error) => this.failWith(error, action));
      if (this.status != Status.READY) return this.pending.push(action), this.open();
      else return this.get().then((value: B) => action(value, this));
    });
  }

  pipe(node: Node<B, any>): Fx<B, any> {
    const branch = new Fx(node, this);
    this.branches.push(branch);
    this.open();
    return branch;
  }

  close() {
    if (!this.trunk) return false;
    const offset = this.trunk.branches.indexOf(this);
    if (offset >= 0) this.trunk.branches.splice(offset, 1);
    return offset >= 0;
  }

}