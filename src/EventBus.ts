import * as Component  from './Component';
import { Event as E }  from './Event';
import { Typer }       from 'cqes-type';

export type eventHandler = (event: E) => Promise<void>;

export interface Transport {
  start:       () => Promise<void>;
  save:        (events: Array<E>) => Promise<void>;
  readFrom:    (category: string, id: string, number: number, handler: eventHandler) => Promise<void>;
  readLast:    (category: string, id: string, count: number) => Promise<Array<E>>;
  subscribe:   (category: string, handler: eventHandler) => Promise<Subscription>;
  psubscribe:  (name: string, category: string, handler: eventHandler) => Promise<Subscription> ;
  stop:        () => Promise<void>;
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
    super({ logger: 'EventBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.category == null) throw new Error('Missing category reference');
    this.transport  = new Transport(props);
    this.category   = props.category;
    this.events     = props.events || {};
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('Connecting to %s', this.category);
    await super.start();
    await this.transport.start();
  }

  public typeEvent(event: E) {
    if (event.type in this.events) {
      try { event.data = this.events[event.type].from(event.data); }
      catch (e) {
        debugger;
        const { number, streamId, category, type } = event;
        this.logger.error('Failed when parsing event %s@%s-%s %s', number, category, streamId, type);
        throw e;
      }
    }
    return event;
  }

  public subscribe(handler: eventHandler): Promise<Subscription> {
    return this.transport.subscribe(this.category, (rawEvent: E) => {
      const event = this.typeEvent(rawEvent);
      return handler(event);
    });
  }

  public psubscribe(name: string, handler: eventHandler): Promise<Subscription> {
    return this.transport.psubscribe(name, this.category, (rawEvent: E) => {
      const event = this.typeEvent(rawEvent);
      return handler(event);
    });
  }

  public emit(category: string, streamId: string, number: number, name: string, data: any, meta?: any) {
    const event = new E(category, streamId, number, name, data, meta);
    return this.emitEvents([event]);
  }

  public emitEvents(events: Array<E>) {
    return this.transport.save(events);
  }

  public readFrom(category: string, streamId: string, number: number, handler: eventHandler) {
    return this.transport.readFrom(category, streamId, number, handler);
  }

  public readLast(category: string, streamId: string, count: number) {
    return this.transport.readLast(category, streamId, count);
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

}
