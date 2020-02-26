import { CommandBus } from './CommandBus';
import { Typer }      from 'cqes-type';
import * as events    from 'events';
import { genId }      from 'cqes-util';

export interface Buses { [name: string]: CommandBus; }
export interface Types { [name: string]: Typer; }

export interface EventEmitter extends events.EventEmitter {}

export interface props {
  commandBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.commandBuses = props.commandBuses || {};
  holder.commandTypes = {};

  holder.command = function (target: string, streamId: string, data: any, meta?: any): EventEmitter {
    const ee = <EventEmitter>new events.EventEmitter();
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
        (<Buses>this.commandBuses)[category].send(streamId, order, data, meta)
          .then(() => ee.emit('sent', ee))
          .catch(error => ee.emit('error', error));
      }
    });
    return ee;
  }

  holder.getCommandTyper = function (context: string, category: string, order: string) {
    const key = context + ':' + category;
    if (key in this.commandTypes) {
      return this.commandTypes[key][order];
    } else {
      const types = this.process.getTypes(context, category, 'commands');
      this.commandTypes[key] = types;
      return types[order];
    }
  }

}
