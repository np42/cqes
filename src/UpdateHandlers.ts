import * as Component   from './Component';
import * as QueryAble   from './QueryAble';
import * as CommandAble from './CommandAble';
import * as StateAble   from './StateAble';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (event: Event) => Promise<void>;

export function getset(target: Object, key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  if (typeof target['get'] !== 'function') throw new Error('Missing .get method');
  if (typeof target['set'] !== 'function') throw new Error('Missing .set method');
  const handler = descriptor.value;
  descriptor.value = async function (event: Event) {
    const data   = await this.get(event.streamId, event);
    const result = await handler.call(this, data, event);
    await this.set(event.streamId, result || data, event);
  };
  return descriptor;
};

export interface props extends Component.props, QueryAble.props, CommandAble.props, StateAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected queryBuses:    QueryAble.Buses;
  protected queryTypes:    QueryAble.Types;
  protected query:         (target: string, data: any, meta?: any) => QueryAble.EventEmitter;
  protected getQueryTyper: (context: string, view: string, method: string) => Typer;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected commandTypes:    CommandAble.Types;
  protected command:         (target: string, streamId: string, data: any, meta?: any) => CommandAble.EventEmitter;
  protected getCommandTyper: (context: string, category: string, order: string) => Typer;
  // About State
  protected repositories: StateAble.Repositories;
  protected get:          (target: string, streamId: string) => Promise<State>;

  constructor(props: props) {
    super(props);
    QueryAble.extend(this, props);
    CommandAble.extend(this, props);
    StateAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.stop()));
    await super.stop();
  }
}
