import { RpcBus }        from './RpcBus';
import { Reply }         from './Reply';
import { AsyncCall }     from './AsyncCall';
import { Typer }         from 'cqes-type';

export interface Buses { [name: string]: RpcBus; }
export interface Types { [name: string]: Typer; }

export interface props {
  rpcBuses?: Buses;
}

export function extend(holder: any, props: props) {
  holder.rpcBuses = props.rpcBuses || {};

  const makeCallable = function (channel: 'query' | 'request') {
    return function (target: Typer, data: any, meta?: any): AsyncCall {
      const ax = new AsyncCall();
      setImmediate(() => {
        const [method, port, context] = target.fqn.split(':').reverse();
        if (port in this.rpcBuses) {
          this.logger.log('%magenta:%s:%blue %s', context, port, method, JSON.stringify(data));
          this.rpcBuses[port][channel](method, data, meta)
            .then((reply: Reply) => ax.reply(reply.type, reply.data))
            .catch((error: Error) => ax.reply(error.name, error));
        } else  {
          const ports = Object.keys(this.rpcBuses).join(', ');
          const message = channel + ' ' + target.fqn + ' not found within [ ' + ports + ' ]';
          ax.reply('busNotFoundError', new Error(message));
        }
      });
      return ax;
    }
  };

  holder.query   = makeCallable('query');
  holder.request = makeCallable('request');
}

