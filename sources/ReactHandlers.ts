import * as Component   from './Component';
import * as RpcAble     from './RpcAble';
import * as CommandAble from './CommandAble';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (state: State, event: Event) => Promise<State>;

export interface props extends Component.props, RpcAble.props, CommandAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected rpcBuses:      RpcAble.Buses;
  protected queryTypes:    RpcAble.Types;
  protected requestTypes:  RpcAble.Types;
  protected query:         (target: Typer, data: any, meta?: any) => RpcAble.EventEmitter;
  protected request:       (target: Typer, data: any, meta?: any) => RpcAble.EventEmitter;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected commandTypes:    CommandAble.Types;
  protected command:         (target: string, streamId: string, data: any, meta?: any) => CommandAble.EventEmitter;
  protected getCommandTyper: (context: string, category: string, order: string) => Typer;

  constructor(props: props) {
    super(props);
    RpcAble.extend(this, props);
    CommandAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.start()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.stop()));
    await Promise.all(Object.values(this.commandBuses).map(bus => bus.stop()));
    await super.stop();
  }
}
