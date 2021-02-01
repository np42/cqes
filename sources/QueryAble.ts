import { QueryBus }      from './QueryBus';
import { Reply }         from './Reply';
import { Typer, Value, IValue
       }                 from 'cqes-type';
import { memoize }       from 'cqes-util';
import * as events       from 'events';

export interface Buses { [name: string]: QueryBus; }
export interface Types { [name: string]: Typer; }

export interface props {
  queryBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.queryBuses = props.queryBuses || {};
  holder.queryTypes = {};

  // @target: '<Context>:<Category>:<View>'
  holder.query = function (target: Typer, data: any, meta?: any): EventEmitter {
    const ee = new EventEmitter();
    ee.onError(error => {
      if (ee.listenerCount('error') == 1) throw error;
    });
    ee.onEnd(reply => {
      if (ee.listenerCount(reply.type) == 0 && ee.listenerCount('end') == 1)
        this.logger.warn('Reply %blue not handled\n%s', reply.type, reply.data);
    });
    setImmediate(() => {
      const [method, view, context] = target.fqn.split(':').reverse();
      if (!(view in this.queryBuses)) {
        const views = Object.keys(this.queryBuses).join(', ');
        ee.emit('error', new Error('View ' + target + ' not found within [ ' + views + ' ]'));
      } else {
        const typer = this.getQueryTyper(context, view, method);
        this.logger.log('%blue %s:%s %s', method, context, view, data);
        if (typer) try { typer.from(data); } catch (e) { return ee.emit('error', e); }
        this.queryBuses[view].request(method, data, meta)
          .catch((error: Error) => ee.emit('error', error))
          .then((reply: Reply) => {
            ee.emit(reply.type, reply.data);
            ee.emit('end', reply);
          });
      }
    });
    return ee;
  }

  holder.getQueryTyper = function (context: string, view: string, method: string) {
    const key = context + ':' + view;
    if (key in this.queryTypes) {
      return this.queryTypes[key][method];
    } else {
      const types = this.process.getTypes(context, view, 'queries');
      this.queryTypes[key] = types;
      return types[method];
    }
  }

}

export class EventEmitter extends events.EventEmitter {

  onError(hook: (error: Error) => void) {
    return super.on('error', hook);
  }

  on(event: string | symbol, hook: (event: any) => void): this;
  on<T extends any>(event: { new (): T }, hook: (event: T) => void): this;
  on(event: any, hook: (event: any) => void) {
    if (!(event instanceof Value)) throw new Error('Only Typed event allowed');
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
