import * as Component   from './Component';
import * as RpcAble     from './RpcAble';
import * as CommandAble from './CommandAble';
import { AsyncCall }    from './AsyncCall';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (state: State, event: Event) => Promise<State>;

export interface props extends Component.props, RpcAble.props, CommandAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected rpcBuses:      RpcAble.Buses;
  protected query:         (target: Typer, data: any, meta?: any) => AsyncCall;
  protected request:       (target: Typer, data: any, meta?: any) => AsyncCall;
  // About Command
  protected commandBuses:    CommandAble.Buses;
  protected command:         (target: string, streamId: string, data: any, meta?: any) => AsyncCall;

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
