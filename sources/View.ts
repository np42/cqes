import * as Component    from './Component';
import * as Query        from './QueryHandlers';
import * as Request      from './RequestHandlers';
import * as Update       from './UpdateHandlers';
import { EventBus }      from './EventBus';
import { EventHandling } from './EventBus';
import { RpcBus }        from './RpcBus';
import { Event as E }    from './Event';
import { Query as Q }    from './Query';
import { Request as Rq } from './Request';
import { Reply as R }    from './Reply';

export { Query, Update, Request };

export interface EventBuses { [name: string]: EventBus };
export interface Subscription { abort: () => Promise<void> };

export interface props extends Component.props {
  eventBuses?:      EventBuses;
  updateHandlers?:  Update.Handlers;
  rpcBus?:          RpcBus;
  queryHandlers?:   Query.Handlers;
  requestHandlers?: Request.Handlers;
}

export class View extends Component.Component {
  protected eventBuses:       EventBuses;
  protected updateHandlers?:  Update.Handlers;
  protected rpcBus:           RpcBus;
  protected queryHandlers?:   Query.Handlers;
  protected requestHandlers?: Request.Handlers;
  protected subscriptions:    Array<Subscription>;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (props.updateHandlers != null && !(props.updateHandlers instanceof Update.Handlers))
      throw new Error('Bad Update Handlers');
    if (props.requestHandlers != null && !(props.requestHandlers instanceof Request.Handlers))
      throw new Error('Bad Request Handlers');
    if (props.queryHandlers != null && !(props.queryHandlers instanceof Query.Handlers))
      throw new Error('Bad Query Handlers');
    super({ type: 'View', ...props });
    this.eventBuses      = props.eventBuses;
    this.updateHandlers  = props.updateHandlers;
    this.rpcBus          = props.rpcBus;
    this.queryHandlers   = props.queryHandlers;
    this.requestHandlers = props.requestHandlers;
    this.subscriptions   = [];
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    await super.start();
    if (this.updateHandlers != null)  await this.updateHandlers.start();
    if (this.requestHandlers != null) await this.requestHandlers.start();
    if (this.queryHandlers != null)   await this.queryHandlers.start();
    if (this.rpcBus != null)          await this.rpcBus.start();
    if (this.updateHandlers != null) {
      this.subscriptions.push(...await Promise.all(Object.values(this.eventBuses).map(async bus => {
        await bus.start();
        const subscription = [this.fqn, bus.category].join(':');
        return bus.psubscribe(subscription, event => this.handleUpdateEvent(event));
      })));
    }
    if (this.rpcBus != null) {
      if (this.queryHandlers != null) {
        const queryHandler   = this.handleQuery.bind(this);
        this.subscriptions.push(await this.rpcBus.serveQuery(queryHandler));
      }
      if (this.requestHandlers != null) {
        const requestHandler = this.handleRequest.bind(this);
        this.subscriptions.push(await this.rpcBus.serveRequest(requestHandler));
      }
    }
  }

  public async stop() {
    if (!this.started) return ;
    await Promise.all(this.subscriptions.map(sub => sub.abort()));
    await Promise.all(Object.values(this.eventBuses).map(bus => bus.stop()));
    if (this.rpcBus != null)          await this.rpcBus.stop();
    if (this.queryHandlers != null)   await this.queryHandlers.stop();
    if (this.requestHandlers != null) await this.requestHandlers.stop();
    if (this.updateHandlers != null)  await this.updateHandlers.stop();
    await super.stop();
  }

  // Event -> Write
  protected getUpdateHandler(event: E): Update.handler {
    const fullname = event.category + '_' + event.type;
    if (fullname in this.updateHandlers) return (<any>this.updateHandlers)[fullname];
    const shortname = event.type;
    if (shortname in this.updateHandlers) return (<any>this.updateHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.updateHandlers) return (<any>this.updateHandlers)[wildname];
  }

  protected async handleUpdateEvent(event: E): Promise<EventHandling> {
    const handler  = this.getUpdateHandler(event);
    if (handler != null) {
      const { number, category, streamId, data } = event;
      this.logger.log('%green %s@%s-%s %s', handler.name, number, category, streamId, data);
      await handler.call(this.updateHandlers, event);
      return EventHandling.Handled;
    } else {
      return EventHandling.Ignored;
    }
  }

  // Request -> Write
  protected getRequestHandler(request: Rq): Request.handler {
    const shortname = request.method;
    if (shortname in this.requestHandlers) return (<any>this.requestHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.requestHandlers) return (<any>this.requestHandlers)[wildname];
    return (request: Rq) => {
      this.logger.warn('Request %s not handled: %s', request.method, request.data);
      return Promise.resolve(new R('NotHandled', { method: request.method }));
    };
  }

  protected handleRequest(request: Rq): Promise<R> {
    const handler = this.getRequestHandler(request);
    return handler.call(this.requestHandlers, request);
  }

  // Query -> Read
  protected getQueryHandler(query: Q): Query.handler {
    const shortname = query.method;
    if (shortname in this.queryHandlers) return (<any>this.queryHandlers)[shortname];
    const wildname = 'ANY';
    if (wildname in this.queryHandlers) return (<any>this.queryHandlers)[wildname];
    return (query: Q) => {
      this.logger.warn('Query %s not handled: %s', query.method, query.data);
      return Promise.resolve(new R('NotHandled', { method: query.method }));
    };
  }

  protected handleQuery(query: Q): Promise<R> {
    const handler = this.getQueryHandler(query);
    return handler.call(this.queryHandlers, query);
  }

}
