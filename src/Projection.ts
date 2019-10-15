import * as Service     from './Service';
import { StateBus }     from './StateBus';
import { State }   from './State';
import { Event }   from './Event';

export type sender = Service.sender;
export type projectionHandler = (state: State, event: Event, sender: sender) => Promise<State>;
export interface ProjectionHandlers { [name: string]: projectionHandler };

export interface props extends Service.props {
  stateBus:           StateBus;
  projectionHandlers: ProjectionHandlers
  partition?:         (event: Event) => string;
}

export class Projection extends Service.Service {
  protected stateBus:           StateBus;
  protected projectionHandlers: ProjectionHandlers;

  constructor(props: props) {
    super({ logger: 'Projection:' + props.name, ...props });
    this.projectionHandlers = props.projectionHandlers;
    this.stateBus           = props.stateBus;
    if (props.partition != null)
      this.partition        = props.partition;
  }

  protected partition(event: Event) {
    return 'main';
  }

  protected async handleServiceEvent(event: Event): Promise<void> {
    const stateId  = this.partition(event);
    const state    = await this.stateBus.get(stateId);
    const newState = await this.handleProjectionEvent(state, event);
    this.stateBus.set(newState);
  }

  protected async handleProjectionEvent(state: State, event: Event) {
    const sender = (name: string, id: string, order: string, data: any, meta?: any) => {
      return this.commandBuses[name].send(id, order, data, meta);
    };
    const handler = this.getProjectionHandler(event);
    return handler.call(this, state, event, sender);
  }

  protected getProjectionHandler(event: Event) {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.projectionHandlers) return this.projectionHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.projectionHandlers) return this.projectionHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.projectionHandlers) return this.projectionHandlers[wildname];
    return (state: State, event: Event, sender: sender) => state;
  }

}
