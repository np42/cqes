enum Status { INITIAL, PENDING, DISRUPTED, READY }

export type Node<N, B> = (value: N, fx: Fx<N, B>)   => Promise<B>;
export type Action<N, B> = (value: B, fx: Fx<N, B>) => Promise<any>;
export type Options = { nocache?: boolean, trunk?: Fx<any, any> };
export type Handler = (payload?: any) => void;
export type DisruptedNotification = { error: any, value: any };

export class Fx<N, B> {

  static create(value: any) {
    return new Fx(async () => value);
  }

  protected node:       Node<N, B>;
  protected trunk:      Fx<any, N>;
  protected branches:   Array<Fx<B, any>>;
  protected pending:    Array<Action<N, B>>;
  protected value:      B;
  protected retryCount: number;
  protected retrying:   NodeJS.Timer;
  protected nocache:    boolean;
  protected events:     Map<string, Array<Handler>>;
  public    status:     Status;

  constructor(node: Node<N, B>, options?: Options) {
    this.node        = node;
    this.trunk       = options ? options.trunk : null;
    this.status      = Status.INITIAL;
    this.value       = null;
    this.retryCount  = 0;
    this.retrying    = null;
    this.pending     = [];
    this.branches    = [];
    this.nocache     = options ? options.nocache : false;
    this.events      = null;
    this.on('aborted', () => {
      for (const branch of this.branches)
        branch.abort();
    });
    this.on('disrupted', e => {
      for (const branch of this.branches)
        branch.failWith(e);
    });
  }

  //-------

  on(event: string, fn: Handler) {
    if (this.events == null) this.events = new Map();
    if (!this.events.has(event)) this.events.set(event, [fn]);
    else this.events.get(event).push(fn);
    return this;
  }

  off(event: string, fn: Handler) {
    if (this.events == null) return this;
    if (!this.events.has(event)) return this;
    const events = this.events.get(event);
    const offset = events.indexOf(fn);
    if (offset >= 0) events.splice(offset, 1);
    if (events.length == 0) this.events.delete(event);
    return this;
  }

  emit(event: string, payload?: any) {
    if (this.events == null) return this;
    const events = this.events.get(event);
    if (events == null) return this;
    for (const fn of events) fn(payload);
    return this;
  }

  //-------

  open() {
    if (this.status == Status.READY)   return this;
    if (this.status == Status.PENDING) return this;
    this.status   = Status.PENDING;
    const fulfill  = (value: B) => this.fulfill(value);
    const failWith = (error: Error) => this.failWith(error);
    if (this.trunk == null) {
      this.produce(null).then(fulfill).catch(failWith);
    } else {
      this.trunk.get().then(value => this.produce(value).then(fulfill).catch(failWith));
    }
    return this;
  }

  produce(value: N) {
    return this.node(value, this);
  }

  abort() {
    if (this.trunk != null) {
      const offset = this.trunk.branches.indexOf(this);
      if (offset >= 0) this.trunk.branches.splice(offset, 1);
    }
    this.emit('aborted');
  }

  fulfill(value: B) {
    this.status     = Status.READY;
    this.retryCount = 0;
    this.value      = value;
    while (this.pending.length > 0)
      this.pending.shift()(value, this);
    for (const branch of this.branches)
      branch.open();
    this.emit('ready');
  }

  failWith(error: Error, action?: Action<N, B>) {
    if (action) this.pending.push(action);
    this.status = Status.DISRUPTED;
    if (this.retryCount == 0) {
      this.retryCount += 1;
      console.log(error);
      this.emit('disrupted', error);
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
      if (this.nocache) this.status = Status.INITIAL;
      switch (this.status) {
      case Status.INITIAL: case Status.PENDING: case Status.DISRUPTED:
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
    const branch = new Fx(node, { trunk: this });
    this.branches.push(branch);
    return branch;
  }


  merge(node: Node<B, any>): Fx<B, any> {
    const branch = new FxWrap(node, { trunk: this });
    this.branches.push(branch);
    return branch;
  }

}

export class FxWrap<N, B> extends Fx<any, B> {

  constructor(node: Node<N, B>, options?: Options) {
    super(node, options);
  }

  get(): Promise<any> {
    return new Promise(resolve => {
      super.get().then((fx: any) => fx.get().then(resolve));
    });
  }

  abort() {
    this.mayGet().then((fx: any) => fx.abort());
    super.abort();
  }

  fulfill(value: B) {
    if (this.value != null) (<any>this.value).abort();
    super.fulfill(value)
  }

  produce(value: N): Promise<B> {
    return new Promise((resolve, reject) => {
      const holder = this;
      return super.produce(value).then((fx: any) => {
        fx.on('disrupted', function self(error: any) {
          fx.off('disrupted', self);
          holder.failWith(error);
        });
        return resolve(fx);
      }).catch(reject);
    });
  }

  mayGet() {
    if (this.status == Status.INITIAL) return new Promise(() => {});
    return super.get();
  }

  open() {
    return super.open();
  }

}
