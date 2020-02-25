import * as Service   from './Service';
import { Component }  from './Component';
import { Typer }      from 'cqes-type';
import { QueryBus }   from './QueryBus';
import { Event }      from './Event';
import { Query }      from './Query';
import { Reply }      from './Reply';

export type queryHandler = (query: Query) => Promise<Reply>;
export type eventHandler = Service.eventHandler;
export interface EventBuses extends Service.EventBuses {};
export interface Subscription { abort: () => Promise<void> };
export interface QueryHandlers { [name: string]: queryHandler };
export interface UpdateHandlers { [name: string]: eventHandler };

export function getset(target: Object, key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  if (typeof target['get'] !== 'function') throw new Error('Missing .get method');
  if (typeof target['set'] !== 'function') throw new Error('Missing .set method');
  const handler = descriptor.value;
  descriptor.value = async function (event: Event, sender: Service.sender) {
    const data   = await this.get(event.streamId, event);
    const result = await handler.call(this, data, event, sender);
    await this.set(event.streamId, result || data, event);
  };
  return descriptor;
};

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
    this.eventBuses     = props.eventBuses     || {};
    this.queryBus       = props.queryBus;
    this.eventHandlers  = props.updateHandlers || {};
    this.queryHandlers  = props.queryHandlers  || {};
    this.subscriptions  = [];
  }

  public async start(): Promise<void> {
    await this.queryBus.start();
    const sub = await this.queryBus.serve((query: Query) => this.handleViewQuery(query));
    this.subscriptions.push(sub);
    const eventHandlers = <Component><any>this.eventHandlers;
    if (eventHandlers.start) await eventHandlers.start();
    const queryHandlers = <Component><any>this.queryHandlers;
    if (queryHandlers.start) await queryHandlers.start();
    await super.start()
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
