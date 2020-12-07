import { QueryBus }      from './QueryBus';
import { Reply }         from './Reply';
import { Typer, IValue, Value
       }                 from 'cqes-type';
import * as events       from 'events';

export interface Buses { [name: string]: QueryBus; }
export interface Types { [name: string]: Typer; }

export interface EventEmitter extends events.EventEmitter {
  expect<T>(type: { new (): T } | string, defaultValue?: T): Promise<T>;
}

export interface props {
  queryBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.queryBuses = props.queryBuses || {};
  holder.queryTypes = {};

  // @target: '<Context>:<Category>:<View>'
  holder.query = function (target: string, data: any, meta?: any): EventEmitter {
    const ee = <EventEmitter>new events.EventEmitter();
    (<any>ee).expect = <T>(typer: { new (v?: any): T } | string, defaultValue?: T): Promise<T> => {
      if (defaultValue == null) defaultValue = null;
      const name = typeof typer === 'string' ? typer : typer.name;
      return new Promise((resolve, reject) => {
        let done = false;
        ee.on(name, result => {
          done = true;
          resolve(result);
        });
        ee.on('error', error => {
          this.logger.error(error);
          if (done) return ;
          done = true;
          reject(error);
        });
        ee.on('end', (reply: Reply) => {
          if (done) return ;
          if (reply.type == null) return resolve(defaultValue);
          this.logger.warn('Query %s expected %s got %s', target, name, reply.type);
          return resolve(defaultValue);
        });
      });
    };
    ee.on('error', (error: Error) => {
      if (ee.listenerCount('error') == 1) throw error;
    });
    ee.on('end', (reply: Reply) => {
      if (ee.listenerCount(reply.type) == 0 && ee.listenerCount('end') == 1)
        this.logger.warn('Reply %blue not handled\n%j', reply.type, reply.data);
    });
    setImmediate(() => {
      const [context, view, method] = target.split(':');
      if (!(view in this.queryBuses)) {
        const views = Object.keys(this.queryBuses).join(', ');
        ee.emit('error', new Error('View ' + target + ' not found within [ ' + views + ' ]'));
      } else {
        const typer = this.getQueryTyper(context, view, method);
        if (typer) try { typer.from(data); } catch (e) { return ee.emit('error', e); }
        this.logger.log('%blue %s:%s %j', method, context, view, data);
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