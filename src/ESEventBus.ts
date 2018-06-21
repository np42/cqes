import { Fx, Node, Action } from './Fx';
import { ESEvent }          from './ESEvent';
import { Event }            from './Event';
import * as ES              from 'node-eventstore-client';
import * as URL             from 'url';
import * as uuid            from 'uuid';

type ESConnection   = ES.EventStoreNodeConnection;
type ESSubscription = ES.EventStoreSubscription;

type SubscriptionNode = Node<ESConnection, ESSubscription>;
type EventHandler     = (event: ESEvent) => Promise<void>;

type FxConnection   = Fx<any, ESConnection>;
type FxSubscription = Fx<SubscriptionNode, ESSubscription>;
type FxEventHandler = Fx<any, EventHandler>;

export class ESEventBus {

  private credentials: ES.UserCredentials;
  private connection:  FxConnection;

  constructor(url: string, settings = {}) {
    const address = URL.parse(url, true);
    const username = decodeURIComponent((address.auth || 'admin').split(':')[0]);
    const password = decodeURIComponent((address.auth || ':changeit').split(':')[1]);
    this.credentials = new ES.UserCredentials(username, password);
    this.connection  = new Fx((_: any, fx: FxConnection): Promise<ESConnection> => {
      return new Promise((resolve, reject) => {
        const origin = address.protocol + '//' + address.host;
        const connection = ES.createConnection(settings, origin);
        connection.connect().catch(reject);
        connection.once('connected', endpoint => resolve(connection));
        connection.once('closed', () => fx.snap(new Error('Connection closed')));
      });
    }).open();
  }

  subscribe(stream: string, from: number, handler: EventHandler | FxEventHandler) {
    const state = { from };
    const fxHandler = <FxEventHandler>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return this.connection.pipe(async (connection, fx) => {
      const subscription = connection.subscribeToStreamFrom(stream, state.from, true, (_, data) => {
        const event = new ESEvent(data.event);
        fxHandler.do((handler: EventHandler) => handler(event)).then(() => {
          state.from = event.number;
        });
      }, () => {
        const event = new Event(stream, '$liveReached');
        fxHandler.do((handler: EventHandler) => handler(event));
      }, () => {
        if ((<any>subscription)._dropData.reason == 'userInitiated') {
          fx.close();
        } else {
          subscription.stop();
          fx.snap(new Error('Connection lost'));
        }
      }, this.credentials);
      return subscription;
    });
  }

  tweak(stream: string, version: number, metadata: Object) {
    return this.connection.try((connection, fx) => {
      return new Promise((resolve, reject) => {
        connection.setStreamMetadataRaw(stream, version, metadata, this.credentials)
          .then(resolve)
          .catch(e => {
            if (e.name == 'WrongExpectedVersionError') return reject(e);
            else return fx.snap(e);
          });
      });
    });
  }

  publish(stream: string, version: number, events: Array<Event>) {
    const esEvents = events.map(event => {
      return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
    });
    return this.connection.try((connection, fx) => {
      return new Promise((resolve, reject) => {
        connection.appendToStream(stream, version, esEvents, this.credentials)
          .then(resolve)
          .catch(e => {
            if (e.name == 'WrongExpectedVersionError') return reject(e);
            else return fx.snap(e);
          });
      });
    });
  }

  last(stream: string, count: number) {
    return this.connection.do(async connection => {
      return (await connection.readStreamEventsBackward(stream, -1, count, true, this.credentials))
        .events.map(data => new ESEvent(data.event));
    });
  }

}
