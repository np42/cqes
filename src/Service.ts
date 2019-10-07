import * as Component   from './Component';
import { CommandBus }   from './CommandBus';
import { EventBus }     from './EventBus';
import { Event }        from './Event';
const  CachingMap       = require('caching-map');

export type sender = (name: string, category: string, id: string, order: string, data: any, meta?: any)
  => Promise<void>;
export type eventHandler = (event: Event, send: sender) => Promise<void>;

export interface CommandBuses { [name: string]: CommandBus };
export interface EventBuses { [name: string]: EventBus };
export interface EventHandlers { [name: string]: eventHandler };
export interface Subscription { abort: () => Promise<void> };

export interface props extends Component.props {
  commandBuses?:  CommandBuses;
  eventBuses?:    EventBuses;
  eventHandlers?: EventHandlers;
}

export class Service extends Component.Component {
  protected commandBuses:  CommandBuses;
  protected eventBuses:    EventBuses;
  protected eventHandlers: EventHandlers;
  protected subscriptions: Array<Subscription>;

  constructor(props: props) {
    super(props);
    this.commandBuses      = props.commandBuses  || {};
    this.eventBuses        = props.eventBuses    || {};
    this.eventHandlers     = props.eventHandlers || {};
    this.subscriptions     = [];
  }

  public start(): Promise<void> {
    const eSubscription = Object.keys(this.eventBuses).map(name => {
      const subscription = [this.name, this.constructor.name].join('.') + ':' + name;
      return this.eventBuses[name].psubscribe(subscription, (event: Event) => {
        return this.handleServiceEvent(event)
      });
    });
    return <any> Promise.all(eSubscription);
  }

  protected async handleServiceEvent(event: Event): Promise<void> {
    const sender = (name: string, category: string, id: string, order: string, data: any, meta?: any) => {
      return this.commandBuses[name].send(category, id, order, data, meta);
    };
    const handler = this.getEventHandler(event);
    this.logger.log('%green %s-%s %j', handler.name, event.category, event.streamId, event.data);
    return handler.call(this.eventHandlers, event, sender);
  }

  protected getEventHandler(event: Event): eventHandler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.eventHandlers) return this.eventHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.eventHandlers) return this.eventHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.eventHandlers) return this.eventHandlers[wildname];
  }

  public stop(): Promise<void> {
    return <any> Promise.all(this.subscriptions.map(subscription => subscription.abort()));
  }

}
