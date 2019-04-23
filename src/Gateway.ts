import * as Service from './Service';

import { command }  from './command';
import { query }    from './query';
import { reply }    from './reply';

export interface props extends Service.props {}
export interface children extends Service.children {}

export class Gateway extends Service.Service {
  constructor(props: props, children: children) {
    super({ type: 'gateway', color: 'yellow', ...props }, children);
  }

  public async start() {
    this.logger.debug('%s Starting %s %s %s', this.constructor.name, this.context, this.name, this.type);
    if (this.factory == null) {
      this.bus.event.psubscribe(this.name, this.context, async event => {
        debugger;
      });
    }
    return super.start();
  }

  public async handle(command: command<any>) {
    const method = 'handle' + command.order;
    if (method in this) {
      this.logger.debug('Handle %s : %s %j', command.id, command.order, command.data);
      try {
        await this[method](command);
        this.bus.command.discard(command);
      } catch (e) {
        this.logger.error(e);
        this.bus.command.replay(command);
      }
    } else {
      this.logger.log('Skip %s : %s %j', command.id, command.order, command.data);
      this.bus.command.discard(command);
    }
  }

  public async resolve(query: query<any>): Promise<reply<any>> {
    const method = 'resolve' + query.method;
    if (method in this) {
      this.logger.log('Resolving %s -> %s', query.view, query.method);
      try {
        const result = await this[method](query);
        if (result instanceof reply) return result;
        return new reply(result);
      } catch (error) {
        if (error instanceof reply) return error;
        return new reply(null, error);
      }
    } else {
      this.logger.log('Ignoring %s -> %s', query.view, query.method);
      return new reply(null, 'Ignored');
    }
  }

}
