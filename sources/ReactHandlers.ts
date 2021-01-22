import * as Component   from './Component';
import * as QueryAble   from './QueryAble';
import * as CommandAble from './CommandAble';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (state: State, event: Event) => Promise<State>;

export interface props extends Component.props, QueryAble.props, CommandAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected queryBuses:    QueryAble.Buses;
  protected queryTypes:    QueryAble.Types;
  protected query:         (target: Typer, data: any, meta?: any) => QueryAble.EventEmitter;
  protected queryMemo:     (target: Typer, data: any, type: Typer) => any;
  protected getQueryTyper: (context: string, view: string, method: string) => Typer;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected commandTypes:    CommandAble.Types;
  protected command:         (target: string, streamId: string, data: any, meta?: any) => CommandAble.EventEmitter;
  protected getCommandTyper: (context: string, category: string, order: string) => Typer;

  constructor(props: props) {
    super(props);
    QueryAble.extend(this, props);
    CommandAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await super.stop();
  }
}
