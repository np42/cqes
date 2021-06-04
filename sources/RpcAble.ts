import { RpcBus }        from './RpcBus';
import { Reply }         from './Reply';
import { Typer,IValue, isType
       }                 from 'cqes-type';
import { memoize }       from 'cqes-util';
import * as events       from 'events';
import { inspect }       from 'util';

export interface Buses { [name: string]: RpcBus; }
export interface Types { [name: string]: Typer; }

export interface props {
  rpcBuses?: Buses;
}

type typerGetter = (context: string, view: string, method: string) => Typer;

export function extend(holder: any, props: props) {
  holder.rpcBuses     = props.rpcBuses || {};
  holder.queryTypes   = {};
  holder.requestTypes = {};

  // @target: '<Context>:<Category>:<View>'
  const makeCallable = function (channel: 'query' | 'request', getTyper: typerGetter) {
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
          const typer = getTyper.call(this, context, view, method);
          this.logger.log('%blue %s:%s %s', method, context, view, data);
          if (typer) try { typer.from(data); } catch (e) { return ee.emit('error', e); }
          this.rpcBuses[view][channel](method, data, meta)
            .then((reply: Reply) => {
              ee.emit(reply.type, reply.data);
              ee.emit('end', reply);
            })
            .catch((error: Error) => {
              ee.emit('error', error)
            })
        }
      });
      return ee;
    }
  };

  holder.query = makeCallable('query', function (context: string, view: string, method: string) {
    const key = context + ':' + view;
    if (key in this.queryTypes) {
      return this.queryTypes[key][method];
    } else {
      const types = this.process.getTypes(context, view, 'queries');
      this.queryTypes[key] = types;
      return types[method];
    }
  });

  holder.request = makeCallable('request', function (context: string, view: string, method: string) {
    const key = context + ':' + view;
    if (key in this.requestTypes) {
      return this.requestTypes[key][method];
    } else {
      const types = this.process.getTypes(context, view, 'requests');
      this.requestTypes[key] = types;
      return types[method];
    }
  });

}

export class EventEmitter extends events.EventEmitter {

  onError(hook: (error: Error) => void) {
    return super.on('error', hook);
  }

  on(event: string | symbol, hook: (event: any) => void): this;
  on<T extends any>(event: { new (): T }, hook: (event: T) => void): this;
  on(event: any, hook: (event: any) => void) {
    if (!isType(event)) throw new Error('Only Typed event allowed, got: ' + inspect(event));
    const protectedHook = (event: any) => {
      try { hook(event); }
      catch (e) { this.emit('error', e); }
    };
    (<Typer>event).name.split('.').forEach(part => {
      const eventName = event.name.slice(event.name.indexOf(part));
      super.on(eventName, hook);
    });
    return this;
  }

  expect<T extends any>(event: { new (): T }): Promise<T> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      this.on(event, (value: any) => { resolved = true; resolve(value) });
      this.onError(error => { if (!resolved) reject(error); });
      this.onEnd(reply => { if (!resolved) reject(new Error('Expected ' + event.name + ', got ' + reply.type)); });
    });
  }

  otherwise(hook: (reply: Reply) => void) {
    return this.onEnd(hook);
  }

  onEnd(hook: (reply: Reply) => void) {
    return super.on('end', hook);
  }

  wait(): Promise<Reply> {
    return new Promise((resolve, reject) => {
      this.onError(reject);
      this.onEnd(resolve);
    });
  }

}
