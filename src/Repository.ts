import * as Component   from './Component';
import * as Bus         from './Bus';

import { query }        from './query';
import { reply }        from './reply';
import { state }        from './state';

export interface props extends Component.props {
  bus: Bus.Bus;
}

export interface children extends Component.children {}

export class Repository extends Component.Component {
  protected bus: Bus.Bus;

  constructor(props: props, children: children) {
    super({ ...props, type: props.type + '.repository', color: 'blue' }, children);
    this.bus = props.bus;
    this['resolve' + this.props.name] = function (query: query<any>) {
      return this.load(query.data.id);
    };
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public save(state: state<any>): Promise<void> {
    return Promise.resolve();
  }

  public load(id: string): Promise<state<any>> {
    return Promise.resolve(new state(id));
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
