import { CommandBus }    from './CommandBus';
import { Typer, IAny }   from 'cqes-type';
import { AsyncCall }     from './AsyncCall';
import { genId }         from 'cqes-util';

export interface Buses { [name: string]: CommandBus; }
export interface Types { [name: string]: Typer; }

export interface props {
  commandBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.commandBuses = props.commandBuses || {};
  holder.commandTypes = {};

  // @target: '<Context>:<Category>:<Order>'
  holder.command = function (command: IAny, streamId: string, data: any, meta?: any): AsyncCall {
    if (command._source == null) throw new Error('Command must be full qualified, add .locate(__filename)');
    const ee = new AsyncCall();
    setImmediate(() => {
      if (ee.listenerCount('error') === 0) {
        ee.onError(error => this.logger.warn(error.toString()));
      }
      const [order, category, context] = command.fqn.split(':').reverse();
      if (!(category in this.commandBuses)) {
        ee.reply('error', new Error('Aggregate: ' + category + ' for command: ' + order + ' not linked'));
      } else {
        const typer = this.getCommandTyper(context, category, order);
        if (typer) try { typer.from(data); } catch (e) { return ee.reply('error', e); }
        if (meta == null) meta = {};
        if (meta.transactionId == null) meta.transactionId = genId();
        (<Buses>this.commandBuses)[category].send(streamId, order, data, meta)
          .then(() => ee.reply('sent', ee))
          .catch(error => ee.reply('error', error));
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
