import * as Component     from './Component';
import * as RpcAble       from './RpcAble';
import * as CommandAble   from './CommandAble';
import * as StateAble     from './StateAble';
import { AsyncCall }      from './AsyncCall';
import { Event }          from './Event';
import { State }          from './State';
import { Typer }          from 'cqes-type';

export interface Constructor<T> { new (...a: Array<any>): T };

export type handler = (event: Event) => Promise<void>;

export function getset(target: Object, key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  if (typeof (<any>target)['get'] !== 'function') throw new Error('Missing .get method');
  if (typeof (<any>target)['set'] !== 'function') throw new Error('Missing .set method');
  const handler = descriptor.value;
  descriptor.value = async function (event: Event) {
    const data   = await this.get(event.streamId, event);
    const result = await handler.call(this, data, event);
    await this.set(event.streamId, result || data, event);
  };
  return descriptor;
};

export interface props extends Component.props, RpcAble.props, CommandAble.props, StateAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected rpcBuses:      RpcAble.Buses;
  protected query:         (target: Typer, data: any, meta?: any) => AsyncCall;
  protected request:       (target: Typer, data: any, meta?: any) => AsyncCall;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected command:         (target: Typer, streamId: string, data: any, meta?: any) => AsyncCall;
  // About State
  protected repositories: StateAble.Repositories;
  protected get:          <X>(target: Constructor<X>, streamId: string, minRevision?: number) => Promise<State<X>>;

  constructor(props: props) {
    super(props);
    RpcAble.extend(this, props);
    CommandAble.extend(this, props);
    StateAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.stop()));
    await super.stop();
  }
}
