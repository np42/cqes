import * as Component         from './Component';
import { event as Event }     from './event';
import * as EventStore        from './EventStore';
import { v4 as uuid }         from 'uuid';

export interface props extends Component.props {
  EventStore?: EventStore.props
}
export interface children extends Component.children {}

export class EventBus extends Component.Component {
  protected es: EventStore.EventStore;

  constructor(props: props, children: children) {
    super({ ...props, type: 'event-bus', color: 'green' }, children);
    this.es = new EventStore.EventStore({ ...this.props, ...props.EventStore }, {});
  }

  public psubscribe(name: string, stream: string, handler: (event: Event<any>) => void): boolean {
    this.logger.log('%green %s.%s', 'PSubscribe', name, stream);
    this.es.psubscribe(name, stream, async (id, revision, date, payload) => {
      JSON.parse(payload.toString()).forEach((item: any) => {
        const event = new Event(item.data, item.meta);
        event.version = item.version;
        event.name = item.name;
        handler(event);
      })
    });
    return true;
  }

  public emit(stream: string, id: string, revision: number, events: Array<Event<any>>) {
    return this.es.emit(stream, id, revision, Buffer.from(JSON.stringify(events)));
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
