import { QueryBus }      from './QueryBus';
import { Reply }         from './Reply';
import { Typer, Value
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
    ee.on('error', (error: Error) => {
      if (ee.listenerCount('error') == 1) throw error;
    });
    ee.on('end', (reply: Reply) => {
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

  holder.queryMemo = memoize((target: Typer, data: any, ExpectedType?: any) => {
    return holder.query(target, data).expect(ExpectedType);
  }, 50);

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
  on<T>(event: string | symbol | { name: string }, hook: (event: T) => void) {
    const protectedHook = (event: T) => {
      try { hook(event); }
      catch (e) { this.emit('error', e); }
    };
    switch (typeof event) {
    case 'string': case 'symbol': {
      super.on(event, hook);
    } break ;
    default : {
      event.name.split('.').forEach(part => {
        const eventName = event.name.slice(event.name.indexOf(part));
        super.on(eventName, hook);
      });
    }
    }
    return this;
  }

  otherwise<T = any>(hook: (reply: Reply) => void) {
    return this.on('end', hook);
  }

  wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.on('error', reject);
      this.on('end',   resolve);
    });
  }

}
