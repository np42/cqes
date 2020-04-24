import * as Component   from './Component';
import * as QueryAble   from './QueryAble';
import * as StateAble   from './StateAble';
import { Service }      from './Service';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (event: Event) => Promise<void>;

export interface props extends Component.props, QueryAble.props, StateAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected queryBuses:    QueryAble.Buses;
  protected queryTypes:    QueryAble.Types;
  protected query:         (target: string, data: any, meta?: any) => QueryAble.EventEmitter;
  protected getQueryTyper: (context: string, view: string, method: string) => Typer;
  // About State
  protected repositories:  StateAble.Repositories;
  protected get:           <X>(type: { new (...a: Array<any>): X }, streamId: string) => Promise<State<X>>;
  // About Service Holder
  protected service:       Service;

  constructor(props: props) {
    super(props);
    QueryAble.extend(this, props);
    StateAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.repositories).map(repo => repo.stop()));
    await super.stop();
  }
}
