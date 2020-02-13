import * as Component       from './Component';
import { QueryBus }         from './QueryBus';
import { Reply }            from './Reply';
import { Typer }            from 'cqes-type';
import { EventEmitter }     from 'events';

export interface QueryBuses { [name: string]: QueryBus };

export interface props extends Component.props {
  queryBuses?:    QueryBuses;
}

const noop = () => {};

export class Connected extends Component.Component {
  protected queryBuses:    QueryBuses;
  protected queryTypes:    { [set: string]: { [name: string]: Typer } };

  constructor(props: props) {
    super(props);
    this.queryBuses    = props.queryBuses    || {};
    this.queryTypes    = {};
  }

  public start(): Promise<void> {
    return <any> Promise.all(Object.keys(this.queryBuses).map(name => {
      return this.queryBuses[name].start();
    }));
  }

  protected query(target: string, data: any, meta?: any): EventEmitter {
    const ee = new EventEmitter();
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

};