import * as Component         from './Component';
import { event as Event }     from './event';
import * as EventStore        from './EventStore';
import { v4 as uuid }         from 'uuid';

export interface props extends Component.props {
  EventStore?: EventStore.props
}
export interface children extends Component.children {}

interface EventHandler {
  (id: string, revision: number, event: Array<Event<any>>): Promise<void>
}

export class EventBus extends Component.Component {
  protected es: EventStore.EventStore;

  static parse(data: string) {
    return JSON.parse(data);
  }

  static stringify(data: any) {
    return JSON.stringify(data);
  }

  constructor(props: props, children: children) {
    super({ ...props, type: 'event-bus', color: 'green' }, children);
    this.es = new EventStore.EventStore({ ...this.props, ...props.EventStore }, {});
  }

  public subscribe(stream: string, handler: EventHandler, position: number): Promise<void> {
    this.logger.log('%green %s', 'Subscribe', stream);
    return this.es.subscribe(stream, async (id, revision, date, payload) => {
      const events = EventBus.parse(payload.toString());
      return handler(id, revision, events);
    }, position);
  }

  public psubscribe(name: string, stream: string, handler: EventHandler): Promise<void> {
    this.logger.log('%green %s.%s', 'PSubscribe', stream, name);
    return this.es.psubscribe(name, stream, async (id, revision, date, payload) => {
      const events = EventBus.parse(payload.toString());
      return handler(id, revision, events);
    });
  }

  public emit(stream: string, id: string, revision: number, events: Array<Event<any>>) {
    return this.es.emit(stream, id, revision, Buffer.from(EventBus.stringify(events)));
  }

  //--

  public start(): Promise<boolean> {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    return this.es.start();
  }

  public stop(): Promise<void> {
    return this.es.stop();
  }

}
