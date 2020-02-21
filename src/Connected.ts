import * as Component       from './Component';
import { QueryBus }         from './QueryBus';
import { CommandBus }       from './CommandBus';
import { Event }            from './Event';
import { Reply }            from './Reply';
import { Typer, IValue }    from 'cqes-type';
import { genId }            from 'cqes-util';
import * as events          from 'events';

export interface QueryBuses   { [name: string]: QueryBus };
export interface CommandBuses { [name: string]: CommandBus };

export interface QueryEventEmitter extends events.EventEmitter {
  expect<T>(type: { new (): T }): Promise<T>;
}

export interface CommandEventEmitter extends events.EventEmitter {
}

export interface props extends Component.props {
  queryBuses?:    QueryBuses;
  commandBuses?:  CommandBuses;
}

const noop = () => {};

export class Connected extends Component.Component {
  protected queryBuses:    QueryBuses;
  protected queryTypes:    { [set: string]: { [name: string]: Typer } };
  protected commandBuses:  CommandBuses;
  protected commandTypes:  { [set: string]: { [name: string]: Typer } };

  constructor(props: props) {
    super(props);
    this.queryBuses    = props.queryBuses    || {};
    this.commandBuses  = props.commandBuses  || {};
    this.queryTypes    = {};
    this.commandTypes  = {};
  }

  public start(): Promise<void> {
    const cChannels = Object.values(this.commandBuses).map(bus => <any>bus.start());
    const qChannels = Object.values(this.queryBuses).map(bus => <any>bus.start());
    return <any> Promise.all([...cChannels, ...qChannels]);
  }

  protected query(target: string, data: any, meta?: any): QueryEventEmitter {
    const ee = <QueryEventEmitter>new events.EventEmitter();
    (<any>ee).expect = (typer: IValue) => new Promise(resolve => {
      let done = false;
      ee.on(typer.name, result => {
        done = true;
        resolve(result);
      });
      ee.on('end', (reply: Reply) => {
        if (done) return ;
        if (reply.type == null) return resolve(null);
        this.logger.warn('Query %s expected %s got %s', target, typer.name, reply.type);
        return resolve(null);
      });
    });
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
        ee.emit('error', new Error('View ' + target + ' not found'));
      } else {
        const typer = this.getQueryTyper(context, view, method);
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

  public getQueryTyper(context: string, view: string, method: string) {
    const key = context + ':' + view;
    if (key in this.queryTypes) {
      return this.queryTypes[key][method];
    } else {
      const types = this.process.getTypes(context, view, 'queries');
      this.queryTypes[key] = types;
      return types[method];
    }
  }


  protected command(target: string, streamId: string, data: any, meta?: any): CommandEventEmitter {
    const ee = <CommandEventEmitter>new events.EventEmitter();
    ee.on('error', error => this.logger.warn(error.toString()));
    setImmediate(() => {
      const [context, category, order] = target.split(':');
      if (!(category in this.commandBuses)) {
        ee.emit('error', new Error('Manager ' + target + ' not found'));
      } else {
        const typer = this.getCommandTyper(context, category, order);
        if (typer) try { typer.from(data); } catch (e) { return ee.emit('error', e); }
        if (meta == null) meta = {};
        if (meta.transactionId == null) meta.transactionId = genId();
        this.commandBuses[category].send(streamId, order, data, meta)
          .then(() => ee.emit('sent', ee))
          .catch(error => ee.emit('error', error));
      }
    });
    return ee;
  }

  public getCommandTyper(context: string, category: string, order: string) {
    const key = context + ':' + category;
    if (key in this.commandTypes) {
      return this.commandTypes[key][order];
    } else {
      const types = this.process.getTypes(context, category, 'commands');
      this.commandTypes[key] = types;
      return types[order];
    }
  }

};