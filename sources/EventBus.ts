import * as Component  from './Component';
import { Event as E }  from './Event';
import { Typer }       from 'cqes-type';

export type eventHandler<T = void>  = (event: E) => Promise<T>;
export enum EventHandling { Ignored, Handled };


export interface Transport {
  start:            () => Promise<void>;
  save:             (events: Array<E>) => Promise<void>;
  readAllFrom:      (position: number, handler: eventHandler) => Promise<void>;
  readCategoryFrom: (category: string, position: number, handler: eventHandler) => Promise<void>;
  readStreamFrom:   (category: string, id: string, number: number, handler: eventHandler) => Promise<void>;
  readStreamLast:   (category: string, id: string, count: number) => Promise<Array<E>>;
  subscribe:        (category: string, handler: eventHandler) => Promise<Subscription>;
  psubscribe:       (name: string, category: string, handler: eventHandler<EventHandling>) => Promise<Subscription> ;
  stop:             () => Promise<void>;
}

export interface Subscription { abort: () => Promise<void>; }
export interface EventTypes   { [name: string]: Typer };

export interface props extends Component.props {
  transport:      string;
  originContext?: string;
  category:       string;
  events:         EventTypes;
}

export class EventBus extends Component.Component {
  protected transport: Transport;
  protected events:    EventTypes;
  readonly  category:  string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.category == null) throw new Error('Missing category reference');
    this.transport  = new Transport({ ...props, type: 'EventBus.Transport' });
    this.category   = props.category;
    this.events     = props.events || {};
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('Connecting to %s', this.category);
    await super.start();
    await this.transport.start();
  }

  public subscribe(handler: eventHandler): Promise<Subscription> {
    return this.transport.subscribe(this.category, (event: E) => {
      return handler(this.typeEvent(event));
    });
  }

  public psubscribe(name: string, handler: eventHandler<EventHandling>): Promise<Subscription> {
    return this.transport.psubscribe(name, this.category, (event: E) => {
      return handler(this.typeEvent(event));
    });
  }

  public emit(category: string, streamId: string, number: number, name: string, data: any, meta?: any) {
    const event = new E(category, streamId, number, name, data, meta);
    return this.emitEvents([event]);
  }

  public emitEvents(events: Array<E>) {
    events.forEach(e => this.logger.log('%green %s %s', e.type, e.stream, e.data));
    return this.transport.save(events);
  }

  public readAllFrom(position: number, handler: eventHandler) {
    return this.transport.readAllFrom(position, (event: E) => {
      return handler(this.typeEvent(event));
    });
  }

  public readCategoryFrom(category: string, position: number, handler: eventHandler) {
    return this.transport.readAllFrom(position, (event: E) => {
      return handler(this.typeEvent(event));
    });
  }

  public readStreamFrom(category: string, streamId: string, number: number, handler: eventHandler) {
    if (category == null) throw new Error('Need a category');
    if (streamId == null) throw new Error('Need a streamId');
    return this.transport.readStreamFrom(category, streamId, number, (event: E) => {
      return handler(this.typeEvent(event));
    });
  }

  public async readStreamLast(category: string, streamId: string, count: number) {
    const result = await this.transport.readStreamLast(category, streamId, count);
    return result.map(event => this.typeEvent(event));
  }

  public typeEvent(event: E) {
    if (event.type in this.events) {
      try {
        event.rawData = event.data;
        event.data    = this.events[event.type].from(event.data);
      } catch (e) {
        debugger;
        const { number, streamId, category, type } = event;
        this.logger.error('Failed when parsing event %s@%s-%s %s', number, category, streamId, type);
        throw e;
      }
    }
    return event;
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

}
