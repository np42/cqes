import * as Service     from './Service';
import { StateBus }     from './StateBus';
import { State }        from './State';
import { Event }        from './Event';

export type sender = Service.sender;
export type triggerHandler = (state: State, event: Event, sender: sender) => Promise<State>;
export interface TriggerHandlers { [name: string]: triggerHandler };

export interface props extends Service.props {
  stateBus:        StateBus;
  triggerHandlers: TriggerHandlers
  partition?:      (event: Event) => string;
}

export class Trigger extends Service.Service {
  protected stateBus:           StateBus;
  protected triggerHandlers: TriggerHandlers;

  constructor(props: props) {
    super({ logger: 'Trigger:' + props.name, ...props });
    this.triggerHandlers = props.triggerHandlers;
    this.stateBus        = props.stateBus;
    if (props.partition != null)
      this.partition     = props.partition;
  }

  protected partition(event: Event) {
    return 'main';
  }

  protected async handleServiceEvent(event: Event): Promise<void> {
    const stateId  = this.partition(event);
    const state    = await this.stateBus.get(stateId);
    const newState = await this.handleTriggerEvent(state, event);
    this.stateBus.set(newState);
  }

  protected async handleTriggerEvent(state: State, event: Event) {
    const handler = this.getTriggerHandler(event);
    return handler.call(this.triggerHandlers, state, event);
  }

  protected getTriggerHandler(event: Event) {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.triggerHandlers) return this.triggerHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.triggerHandlers) return this.triggerHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.triggerHandlers) return this.triggerHandlers[wildname];
    return (state: State, event: Event, sender: sender) => state;
  }

}
