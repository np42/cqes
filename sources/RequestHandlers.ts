import * as Component    from './Component';
import * as RpcAble      from './RpcAble';
import * as CommandAble  from './CommandAble';
import * as StateAble    from './StateAble';
import { AsyncCall }     from './AsyncCall';
import { Query }         from './Query';
import { Reply }         from './Reply';
import { State }         from './State';
import { Typer }         from 'cqes-type';

export interface Constructor<T> { new (...a: Array<any>): T };

export type handler = (query: Query) => Promise<Reply>;

export interface props extends Component.props, RpcAble.props, CommandAble.props, StateAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected rpcBuses:      RpcAble.Buses;
  protected queryTypes:    RpcAble.Types;
  protected requestTypes:  RpcAble.Types;
  protected query:         (target: Typer, data: any, meta?: any) => AsyncCall;
  protected request:       (target: Typer, data: any, meta?: any) => AsyncCall;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected commandTypes:    CommandAble.Types;
  protected command:         (target: Typer, streamId: string, data: any, meta?: any) => AsyncCall;
  protected getCommandTyper: (context: string, category: string, order: string) => Typer;
  // About State
  protected repositories: StateAble.Repositories;
  protected get:          <X>(type: Constructor<X>, streamId: string, minRevision?: number) => Promise<State<X>>;

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
