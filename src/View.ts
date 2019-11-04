import * as Service   from './Service';
import { Typer }        from './Type';
import { QueryBus }     from './QueryBus';
import { Event }        from './Event';
import { Query }        from './Query';
import { Reply }        from './Reply';

export type queryHandler = (query: Query) => Promise<Reply>;
export type eventHandler = Service.eventHandler;
export interface EventBuses extends Service.EventBuses {};
export interface QueryHandlers { [name: string]: queryHandler };
export interface UpdateHandlers { [name: string]: eventHandler };
export interface Subscription { abort: () => Promise<void> };

export interface props extends Service.props {
  queryBus?:       QueryBus;
  queryHandlers?:  QueryHandlers;
  updateHandlers?: UpdateHandlers;
}

export class View extends Service.Service {
  protected queryBus:       QueryBus;
  protected queryHandlers:  QueryHandlers;

  constructor(props: props) {
    super({ logger: 'View:' + props.name, ...props });
    this.eventBuses       = props.eventBuses     || {};
    this.queryBus         = props.queryBus;
    this.eventHandlers    = props.updateHandlers || {};
    this.queryHandlers    = props.queryHandlers  || {};
    this.subscriptions    = [];
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      super.start().catch(reject).then(async () => {
        await this.queryBus.start();
        this.queryBus.serve((query: Query) => this.handleViewQuery(query))
          .then((subscription: Subscription) => {
            this.subscriptions.push(subscription);
            resolve();
          }).catch(reject);
      });
    });
  }

  protected handleViewQuery(query: Query): Promise<Reply> {
    const handler = this.getQueryHandler(query);
    return handler.call(this.queryHandlers, query);
  }

  public getQueryHandler(query: Query): queryHandler {
    const shortname = query.method;
    if (shortname in this.queryHandlers) return this.queryHandlers[shortname];
    const wildname = 'any';
    if (wildname in this.queryHandlers) return this.queryHandlers[wildname];
    return (query: Query) => {
      this.logger.warn('Query %s not handled: %j', query.method, query.data);
      return Promise.resolve(new Reply('NotHandled', { method: query.method }));
    };
  }

}
