import * as Component   from './Component';
import * as QueryAble   from './QueryAble';
import * as CommandAble from './CommandAble';
import * as StateAble   from './StateAble';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (query: Query) => Promise<Reply>;

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
  protected get:           <X>(type: { new (...a: Array<any>): X }, streamId: string) => Promise<State<X>>;

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
