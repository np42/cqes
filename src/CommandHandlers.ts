import * as Component from './Component';
import * as QueryAble from './QueryAble';
import { Typer }      from 'cqes-type';

export interface props extends Component.props, QueryAble.props {}

export class Handlers extends Component.Component {
  // About Query
  protected queryBuses:    QueryAble.Buses;
  protected queryTypes:    QueryAble.Types;
  protected query:         (target: string, data: any, meta?: any) => QueryAble.EventEmitter;
  protected getQueryTyper: (context: string, view: string, method: string) => Typer;

  constructor(props: props) {
    super(props);
    QueryAble.extend(this, props);
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.start()));
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await Promise.all(Object.values(this.queryBuses).map(bus => bus.stop()));
    await super.stop();
  }
}

