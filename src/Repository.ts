import * as Service from './Service';

import { query }    from './query';
import { reply }    from './reply';
import { state }    from './state';
import { event }    from './event';

export interface props extends Service.props {}
export interface children extends Service.children {}

export class Repository extends Service.Service {
  constructor(props: props, children: children) {
    super({ ...props, type: 'repository', color: 'cyan' }, children);
  }

  public async start() {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    this.bus.query.serve(this.name, async query => {
      const reply = await this.resolve(query);
      this.bus.query.reply(query, reply);
    });
    this.bus.event.psubscribe(this.name, this.context, async event => {
      debugger;
    });
    return super.start();
  }

  public async on(state: state<any>, event: event<any>) {
    debugger;
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
        if (error instanceof Error) this.logger.error(error);
        return new reply(null, error);
      }
    } else {
      this.logger.log('Ignoring %s -> %s', query.view, query.method);
      return new reply(null, 'Ignored');
    }
  }

}
