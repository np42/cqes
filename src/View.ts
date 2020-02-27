import * as Component  from './Component';
import * as Query      from './QueryHandlers';
import * as Update     from './UpdateHandlers';
import { EventBus }    from './EventBus';
import { QueryBus }    from './QueryBus';
import { Event as E }  from './Event';
import { Query as Q }  from './Query';
import { Reply as R }  from './Reply';

export { Query, Update };

export interface EventBuses { [name: string]: EventBus };
export interface Subscription { abort: () => Promise<void> };

export interface props extends Component.props {
  eventBuses?:     EventBuses;
  updateHandlers?: Update.Handlers;
  queryBus?:       QueryBus;
  queryHandlers?:  Query.Handlers;
}

export class View extends Component.Component {
  protected eventBuses:     EventBuses;
  protected updateHandlers: Update.Handlers;
  protected queryBus:       QueryBus;
  protected queryHandlers:  Query.Handlers;
  protected subscriptions:  Array<Subscription>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.updateHandlers instanceof Update.Handlers)) throw new Error('Bad Update Handlers');
    if (!(props.queryHandlers instanceof Query.Handlers)) throw new Error('Bad Query Handlers');
    super({ type: 'View', ...props });
    this.eventBuses     = props.eventBuses;
    this.updateHandlers = props.updateHandlers;
    this.queryBus       = props.queryBus;
    this.queryHandlers  = props.queryHandlers;
    this.subscriptions  = [];
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    await this.updateHandlers.start();
    await this.queryHandlers.start();
    await this.queryBus.start();
    this.subscriptions = await Promise.all(Object.values(this.eventBuses).map(async bus => {
      await bus.start();
      const subscription = [this.fqn, bus.category].join(':');
      return bus.psubscribe(subscription, event => this.handleUpdateEvent(event));
    }));
    this.subscriptions.push(await this.queryBus.serve(query => this.handleViewQuery(query)));
  }

  protected getUpdateHandler(event: E): Update.handler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.updateHandlers) return this.updateHandlers[fullname];
    const shortname = event.type;
    if (shortname in this.updateHandlers) return this.updateHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.updateHandlers) return this.updateHandlers[wildname];
  }

  protected handleUpdateEvent(event: E) {
    const handler  = this.getUpdateHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%blue %s@%s-%s %j', handler.name, number, category, streamId, data);
      return handler.call(this.updateHandlers, event);
    }
  }

  protected getQueryHandler(query: Q): Query.handler {
    const shortname = query.method;
    if (shortname in this.queryHandlers) return this.queryHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.queryHandlers) return this.queryHandlers[wildname];
    return (query: Q) => {
      this.logger.warn('Query %s not handled: %j', query.method, query.data);
      return Promise.resolve(new R('NotHandled', { method: query.method }));
    };
  }

  protected handleViewQuery(query: Q): Promise<R> {
    const handler = this.getQueryHandler(query);
    return handler.call(this.queryHandlers, query);
  }

  public async stop() {
    if (!this.started) return ;
    await Promise.all(this.subscriptions.map(sub => sub.abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    await this.queryBus.stop();
    await this.queryHandlers.stop();
    await this.updateHandlers.stop();
    await super.stop();
  }

}
