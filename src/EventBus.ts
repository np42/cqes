import * as Element         from './Element';
import { event as Event }   from './event';
import * as EventStore      from './EventStore';
import { v4 as uuid }       from 'uuid';

export interface props extends Element.props {
  EventStore?: EventStore.props
}

interface EventHandler {
  (id: string, revision: number, event: Array<Event<any>>, date: number): Promise<void>
}

export class EventBus extends Element.Element {
  protected props: props;
  protected es: EventStore.EventStore;

  static parse(data: string) {
    return JSON.parse(data);
  }

  static stringify(data: any) {
    return JSON.stringify(data);
  }

  constructor(props: props) {
    super(props);
    this.props = props;
    const childProps = { context: props.context, logger: props.logger };
    this.es = new EventStore.EventStore({ ...childProps, ...props.EventStore });
  }

  public subscribe(stream: string, handler: EventHandler, position: number): Promise<void> {
    this.logger.log('%green %s', 'Subscribe', stream);
    return this.es.subscribe(stream, async (id, revision, date, payload) => {
      const events = EventBus.parse(payload.toString());
      return handler(id, revision, events, date);
    }, position);
  }

  public psubscribe(name: string, stream: string, handler: EventHandler): Promise<void> {
    this.logger.log('%green %s.%s', 'PSubscribe', stream, name);
    return this.es.psubscribe(name, stream, async (id, revision, date, payload) => {
      const events = EventBus.parse(payload.toString());
      return handler(id, revision, events, date);
    });
  }

  public emit(stream: string, id: string, revision: number, events: Array<Event<any>>) {
    return this.es.emit(stream, id, revision, Buffer.from(EventBus.stringify(events)));
  }

  //--

  public async start(): Promise<boolean> {
    if (this.props.EventStore) {
      this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
      return this.es.start();
    } else {
      return true;
    }
  }

  public stop(): Promise<void> {
    if (this.props.EventStore) {
      return this.es.stop();
    } else {
      return ;
    }
  }

}
