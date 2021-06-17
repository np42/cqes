import { Reply }         from './Reply';
import { Typer, isType } from 'cqes-type';
import { inspect }       from 'util';

interface response { type: string, data: any };

interface options {
  timeout: number;
};

export class AsyncCall {
  private listeners:       { [name: string]: Array<(data: any) => void> };
  private timeoutDuration: number;
  private timeoutTimer:    NodeJS.Timer;
  private repliedType:     string;

  constructor(options?: options) {
    this.listeners = {};
    this.setTimeout(options?.timeout || 60000);
  }

  public reply(type: string, data: any) {
    if (this.repliedType) {
      throw new Error('Can\'t handle ' + type + ' because ' + this.repliedType + ' already replied');
    }
    this.repliedType = type;
    if (this.timeoutTimer != null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    const hasHandler = type in this.listeners;
    if (hasHandler) {
      this.emit(type, data);
    } else if ('error' in this.listeners && (type === 'error' || type.slice(-5) === 'Error')) {
      this.emit('error', data);
    }
    this.emit('end', { type, data });
  }

  public listenerCount(name: string) {
    return this.listeners[name]?.length || 0;
  }

  public on<T>(type: { new(): T }, hook: (data: T) => any) {
    if (!isType(type)) throw new Error('Only Typed event allowed, got: ' + inspect(type));
    const protectedHook = (data: any) => {
      try { hook(type.from(data)); }
      catch (e) { this.emit('error', e); }
    };
    (<Typer>type).name.split('.').forEach(part => {
      const eventName = type.name.slice(type.name.indexOf(part));
      this.bind(eventName, protectedHook);
    });
    return this;
  }

  public setTimeout(duration: number, hook?: () => void) {
    if (!(duration >= 1)) throw new Error('duration have to be at least 1ms');
    if (this.timeoutTimer != null) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      this.reply('timeoutError', new Error('Timed out after ' + duration  + 'ms'));
    }, duration);
    if (hook != null) return this.onTimeout(hook);
  }

  public onTimeout(hook: () => void) {
    return this.bind('timeoutError', hook);
  }

  public onError(hook: (error: Error) => void) {
    return this.bind('error', hook);
  }

  public onEnd(hook: (response: response) => void) {
    return this.bind('end', hook);
  }

  public expect<T extends any>(event: { new (): T }): Promise<T> {
    return new Promise((resolve, reject) => {
      this.on(event, (value: any) => { resolve(value); });
      this.onError(error => { reject(error); });
    });
  }

  public wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.onError(reject);
      this.onEnd(() => resolve());
    });
  }

  // ------------------

  private bind(name: string, hook: (data: any) => void) {
    if (this.listeners[name] == null)
      this.listeners[name] = [hook];
    else
      this.listeners[name].push(hook);
    return this;
  }

  private emit(name: string, data: any) {
    const listeners = this.listeners[name];
    if (listeners == null) return ;
    for (let i = 0, l = listeners.length; i < l; i += 1)
      listeners[i](data);
  }

}
