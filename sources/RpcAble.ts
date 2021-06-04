import { RpcBus }        from './RpcBus';
import { Reply }         from './Reply';
import { Typer, isType } from 'cqes-type';
import { memoize }       from 'cqes-util';
import { inspect }       from 'util';

export interface Buses { [name: string]: RpcBus; }
export interface Types { [name: string]: Typer; }

export interface props {
  rpcBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.rpcBuses = props.rpcBuses || {};

  const makeCallable = function (channel: 'query' | 'request') {
    return function (target: Typer, data: any, meta?: any): EventEmitter {
      const ee = new EventEmitter();
      setImmediate(() => {
        if (ee.listenerCount('end') === 0) {
          ee.onEnd(reply => {
            if (ee.listenerCount(reply.type) === 0) {
              const error = new Error('Reply ' + reply.type + ' not handled\nwith: ' + JSON.stringify(reply.data));
              ee.emit('error', error);
            }
          });
        }
        if (ee.listenerCount('error') === 0) {
          ee.onError(error => {
            this.logger.error('Uncaught Error: %e', error);
          });
        }
        const [method, view, context] = target.fqn.split(':').reverse();
        if (!(view in this.rpcBuses)) {
          const views = Object.keys(this.rpcBuses).join(', ');
          ee.emit('error', new Error('View ' + target + ' not found within [ ' + views + ' ]'));
        } else {
          this.logger.log('%blue %s:%s %s', method, context, view, data);
          this.rpcBuses[view][channel](method, data, meta)
            .then((reply: Reply) => {
              if (reply.type.slice(-5) === 'Error' && ee.listenerCount(reply.type) === 0) {
                ee.emit('error', reply.data);
              } else {
                ee.emit(reply.type, reply.data);
                ee.emit('end', reply);
              }
            })
            .catch((error: Error) => {
              ee.emit('error', error)
            })
        }
      });
      return ee;
    }
  };

  holder.query   = makeCallable('query');
  holder.request = makeCallable('request');
}

export class EventEmitter {
  private listeners: { [name: string]: Array<(data: any) => void> };

  constructor() {
    this.listeners = {};
  }

  bind(name: string, hook: (data: any) => void) {
    if (this.listeners[name] == null)
      this.listeners[name] = [hook];
    else
      this.listeners[name].push(hook);
  }

  emit(name: string, data: any) {
    const listeners = this.listeners[name];
    if (listeners == null) return ;
    for (let i = 0, l = listeners.length; i < l; i += 1)
      listeners[i](data);
  }

  listenerCount(name: string) {
    return this.listeners[name]?.length || 0;
  }

  on<T>(type: { new(): T }, hook: (data: T) => any) {
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

  onError(hook: (error: Error) => void) {
    return this.bind('error', hook);
  }

  onEnd(hook: (reply: Reply) => void) {
    return this.bind('end', hook);
  }

  expect<T extends any>(event: { new (): T }): Promise<T> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      this.on(event, (value: any) => { resolved = true; resolve(value) });
      this.onError(error => { if (!resolved) reject(error); });
      this.onEnd(reply => { if (!resolved) reject(new Error('Expected ' + event.name + ', got ' + reply.type)); });
    });
  }

  wait(): Promise<Reply> {
    return new Promise((resolve, reject) => {
      this.onError(reject);
      this.onEnd(resolve);
    });
  }

}
