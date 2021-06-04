import * as Component    from './Component';
import * as RpcAble      from './RpcAble';
import { State }         from './State';
import { Command }       from './Command';
import { Event }         from './Event';
import { Typer }         from 'cqes-type';

export type emitter = (type: Typer | Event, data: any, meta?: any) => void
export type handler = (state: State, command: Command, emit?: emitter) => Array<Event> | Event | void;

export interface props extends Component.props, RpcAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected rpcBuses:       RpcAble.Buses;
  protected queryTypes:     RpcAble.Types;
  protected requestTypes:   RpcAble.Types;
  protected query:          (target: Typer, data: any, meta?: any) => RpcAble.EventEmitter;
  protected request:        (target: Typer, data: any, meta?: any) => RpcAble.EventEmitter;

  constructor(props: props) {
    super(props);
    RpcAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.rpcBuses).map(bus => bus.stop()));
    await super.stop();
  }
}

