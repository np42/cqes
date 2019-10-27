import * as Component  from './Component';
import { Event as E }  from './Event';
import { Typer }       from './Type';

export type eventHandler = (event: E) => Promise<void>;

export interface Transport {
  start:       () => Promise<void>;
  save:        (events: Array<E>) => Promise<void>;
  readFrom:    (category: string, id: string, number: number, handler: eventHandler) => Promise<void>;
  subscribe:   (category: string, handler: eventHandler) => Promise<Subscription>;
  psubscribe:  (name: string, category: string, handler: eventHandler) => Promise<Subscription> ;
  stop:        () => Promise<void>;
}

export interface Subscription { abort: () => Promise<void>; }
export interface EventTypes   { [name: string]: Typer };

export interface props extends Component.props {
  transport:  string;
  stream:     string;
  events:     EventTypes;
}

export class EventBus extends Component.Component {
  protected transport: Transport;
  protected stream:    string;
  protected events:    EventTypes;

  constructor(props: props) {
    super({ logger: 'EventBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    if (props.stream == null) throw new Error('Missing stream reference');
    this.transport  = new Transport(props);
    this.stream     = props.stream;
    this.events     = props.events || {};
  }

  public subscribe(handler: eventHandler): Promise<Subscription> {
    return this.transport.subscribe(this.stream, handler);
  }

  public psubscribe(name: string, handler: eventHandler): Promise<Subscription> {
    return this.transport.psubscribe(name, this.stream, (event: E) => {
      if (event.type in this.events) event.data = this.events[event.type].from(event.data);
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

}
