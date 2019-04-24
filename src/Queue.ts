export class Queue {
  public    running: boolean;
  protected pending: Array<any>;

  constructor(running: boolean = false) {
    this.pending = [];
    this.running = running;
  }

  public pause() {
    this.running = false;
  }

  public resume() {
    this.running = true;
    this.drain();
  }

  public push(context: any, handler: any, ...args: Array<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pending.push({ context, handler, args, resolve, reject });
      if (this.running) this.drain();
    });
  }

  public drain() {
    while (this.running && this.pending.length > 0) {
      const item = this.pending.shift();
      try {
        const result = item.handler.apply(item.context, item.args);
        if (result && typeof result.then === 'function' && typeof result.catch === 'function')
          result.then(item.resolve).catch(item.reject);
        else
          item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }
  }

}