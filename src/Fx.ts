enum Status { INITIAL, PENDING, DISRUPTED, READY, ABORTED }

export type Node<N, B>   = (value: N, fx: Fx<N, B>) => Promise<B>;
export type Action<N, B> = (value: B, fx: Fx<N, B>) => any;
export type Handler = (payload?: any) => void;
export type DisruptedNotification = { error: any, value: any };

export interface Options {
  name?: string;
  nocache?: boolean;
  trunk?: Fx<any, any>;
  nextRetry?: Array<number> | ((count: number) => number);
};

type PendingAction<N, B> = PendingActionSuccess<N, B> | PendingActionFailure<N, B>;

interface PendingActionSuccess<N, B> {
  action: Action<N, B>;
  resolve: (result: any) => void;
};

interface PendingActionFailure<N, B> {
  action: Action<N, B>;
  reject: (error: any) => void;
};

export class Fx<N, B> {

  static create(data: any, options: Options = {}): Fx<any, any> {
    return new Fx(async () => data, options).open();
  }

  static newName() {
    const name = [];
    while (name.length < 10) {
      const c = Math.floor(Math.random() * (10 + 26 + 26));
      if (c < 10) name.push(String.fromCharCode(48 + c));
      else if (c < 36) name.push(String.fromCharCode(55 + c));
      else name.push(String.fromCharCode(61 + c));
    }
    return name.join('');
  }

  static wrapNextRetry(next: Array<number> | ((count: number) => number)) {
    if (typeof next == 'function') return next;
    if (next instanceof Array) return (count: number) => next[Math.min(next.length - 1, count - 1)];
    return (count: number) => Math.min(Math.pow(count, 3) * 42, 15000);
  }

  protected name:       string;
  protected node:       Node<N, B>;
  protected trunk:      Fx<any, N>;
  protected branches:   Map<string, Fx<B, any>>;
  protected pending:    Array<PendingAction<N, B>>;
  protected bridge:     Fx<any, any>;
  protected data:       B;
  protected lastParent: number;
  protected nextRetry:  (count: number) => number;
  protected retryCount: number;
  protected retrying:   NodeJS.Timer;
  protected nocache:    boolean;
  protected events:     Map<string, Array<Handler>>;
  public    status:     Status;

  constructor(node: Node<N, B>, options: Options = {}) {
    this.node        = node;
    this.status      = Status.INITIAL;
    this.name        = options.name || Fx.newName();
    this.data        = null;
    this.lastParent  = null;
    this.retryCount  = 0;
    this.retrying    = null;
    this.events      = null;
    this.pending     = [];
    this.branches    = new Map();
    this.trunk       = options.trunk   || null;
    this.nocache     = options.nocache || false;
    this.nextRetry   = Fx.wrapNextRetry(options.nextRetry);
  }

  //-------

  on(event: string, fn: Handler) {
    if (this.events == null) this.events = new Map();
    if (!this.events.has(event)) this.events.set(event, [fn]);
    else this.events.get(event).push(fn);
    return this;
  }

  one(event: string, fn: Handler) {
    const clear = () => {
      this.off(event, fn);
      this.off(event, clear);
    };
    this.on(event, fn);
    this.on(event, clear);
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

  open(propaged: boolean = false) {
    if (this.status == Status.READY)   return this;
    if (this.status == Status.PENDING) return this;
    if (this.status == Status.ABORTED) {
      while (this.pending.length > 0) {
        const pendingAction = <any>this.pending.shift();
        if ('reject' in pendingAction) pendingAction.reject('ABORTED');
        else if ('resolve' in pendingAction) pendingAction.resolve(null);
      }
      return this;
    }
    if (propaged) this.lastParent = Date.now();
    this.status    = Status.PENDING;
    const fulfill  = (value: B) => this.fulfill(value);
    const failWith = (error: Error) => this.failWith(error);
    if (this.trunk == null) {
      this.produce(null).then(fulfill).catch(failWith);
    } else {
      this.trunk.value().then(value => this.produce(value).then(fulfill).catch(failWith));
    }
    return this;
  }

  produce(param: N) {
    return this.node(param, this);
  }

  fulfill(data: B) {
    if (this.status == Status.ABORTED) return ;
    this.status     = Status.READY;
    this.retryCount = 0;
    this.data       = data;
    while (this.pending.length > 0)
      this.pending.shift().action(data, this);
    for (const [name, branch] of this.branches)
      branch.open(true);
    this.emit('ready');
  }

  failWith(error: Error | string, propaged: boolean = false) {
    if (this.status == Status.ABORTED) return ;
    this.status = Status.DISRUPTED;
    if (this.retryCount == 0) {
      console.log('Fx[' + this.name + '].failWith', 0, error);
      if (error instanceof Error) error = String(error);
      this.retryCount += 1;
      const nextRetry = this.nextRetry(this.retryCount);
      this.emit('disrupted', error);
      for (const [name, branch] of this.branches)
        branch.failWith(error, true);
      if (this.bridge)
        this.bridge.failWith(error, true);
      if (nextRetry != null)
        this.retrying = setTimeout(() => { this.retrying = null; this.open() }, nextRetry);
    } else if (!(this.trunk instanceof Fx) || Date.now() < this.lastParent + 60000) {
      if (this.retrying == null) {
        console.log('Fx[' + this.name + ']:', this.retryCount, String(error));
        this.retryCount += 1;
        const nextRetry = this.nextRetry(this.retryCount);
        if (nextRetry != null)
          this.retrying = setTimeout(() => { this.retrying = null; this.open() }, nextRetry);
      }
    } else if (this.retryCount > 0) {
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

  value(): Promise<B> {
    return new Promise((resolve, reject) => {
      if (this.nocache) this.status = Status.INITIAL;
      switch (this.status) {
      case Status.INITIAL: case Status.PENDING: case Status.DISRUPTED:
        this.pending.push({ action: async data => resolve(data), reject });
        if (this.status == Status.INITIAL) this.open();
        return ;
      case Status.READY:
        return resolve(this.data);
      case Status.ABORTED:
        return reject('ABORTED');
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

  //

  get(name: string) {
    const branch = this.branches.get(name);
    if (branch == null) return Fx.create(null);
    return branch;
  }

  set(branch: Fx<B, any>) {
    const name = branch.name;
    const old = this.branches.get(name);
    if (old) old.abort();
    this.branches.set(name, branch);
    return this;
  }

  //
  try(method: Action<N, B>, count: number = 1): Promise<any> {
    return new Promise((resolve, reject) => {
      const action = (value: B, fx: Fx<N, B>) => {
        let error  = null;
        let result = null;
        try { result = method(value, fx); }
        catch (e) { error = e }
        if (result instanceof Promise) {
          return result.then(resolve).catch((error: any) => {
            if (count > 1) return this.try(method, count - 1).then(resolve).catch(reject);
            else return reject(error);
          });
        } else if (error) {
          if (count > 1) return this.try(method, count - 1).then(resolve).catch(reject);
          else return reject(error);
        } else {
          return resolve(result);
        }
      };
      if (this.status != Status.READY) return this.pending.push({ action, reject }), this.open();
      else return this.value().then((value: B) => action(value, this));
    });
  }

  do(method: Action<N, B>): Promise<any> {
    return new Promise(resolve => {
      const action = (value: B, fx: Fx<N, B>) => {
        let error  = null;
        let result = null;
        try { result = method(value, fx); }
        catch (e) { error = e; }
        if (result instanceof Promise) {
          return result.then(resolve).catch((error: Error) => {
            this.pending.push({ action, resolve });
            return this.failWith(error);
          });
        } else if (error) {
          this.pending.push({ action, resolve });
          return this.failWith(error);
        } else {
          return resolve(result);
        }
      };
      if (this.status != Status.READY) {
        this.pending.push({ action, resolve });
        return this.open();
      } else {
        return this.value().then((value: B) => action(value, this));
      }
    });
  }

  //
  pipe(node: Node<B, any>, options: Options = {}): Fx<B, any> {
    const branch = new Fx(node, { ...options, trunk: this });
    this.set(branch);
    if (this.status == Status.READY) branch.open();
    return branch;
  }


  merge(node: Node<B, any>, options: Options = {}): Fx<B, any> {
    const branch = new FxWrap(node, { ...options, trunk: this });
    this.set(branch);
    if (this.status == Status.READY) branch.open();
    return branch;
  }

}

export class FxWrap<N, B> extends Fx<any, B> {

  constructor(node: Node<N, B>, options?: Options) {
    super(node, options);
  }

  value(): Promise<any> {
    return new Promise(resolve => {
      super.value().then((fx: any) => fx.value().then(resolve));
    });
  }

  mayValue() {
    if (this.status == Status.INITIAL)
      return new Promise(() => {});
    if (this.status == Status.READY && this.nocache == false)
      return <any>{ then: (f: any) => f(this.data) };
    else
      return super.value();
  }

  produce(value: any): Promise<B> {
    return new Promise((resolve, reject) => {
      return super.produce(value).then((fx: any) => {
        if (this.data != null) (<any>this.data).abort();
        fx.bridge = this;
        return resolve(fx);
      }).catch(reject);
    });
  }

  failWith(error: any) {
    this.mayValue().then((fx: any) => fx.abort());
    super.failWith(error)
  }

  abort() {
    if (this.status == Status.ABORTED) return ;
    this.mayValue().then((fx: any) => fx.abort());
    super.abort();
  }

}
