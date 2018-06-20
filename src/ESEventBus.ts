import { Fx }    from './Fx';
import * as ES   from 'node-eventstore-client';
import * as URL  from 'url';
import * as uuid from 'uuid';

export class ESEventBus {

  private credentials: ES.UserCredentials;
  private connection: Fx;

  constructor(url: string, settings = {}) {
    const address = <any>URL.parse(url, true);
    const username = decodeURIComponent((address.auth || 'admin').split(':')[0]);
    const password = decodeURIComponent((address.auth || ':changeit').split(':')[1]);
    this.credentials = new ES.UserCredentials(username, password);
    this.connection = new Fx((_, fx) => {
      return new Promise((resolve, reject) => {
        const origin = address.protocol + '//' + address.host;
        const connection = ES.createConnection(settings, origin);
        connection.connect().catch(reject);
        connection.once('connected', endpoint => resolve(connection));
        connection.once('closed', () => fx.snap('Connection closed'));
      });
    }).open();
  }

  subscribe(stream, from, handler) {
    const state = { from };
    if (!(handler instanceof Fx)) handler = Fx.create(handler).open();
    return this.connection.pipe(async (connection, fx) => {
      const subscription = connection.subscribeToStreamFrom(stream, state.from, true, (_, data) => {
        const event = new ESEvent(data.event);
        handler.do(handler => handler(event)).then(() => {
          state.from = event.eventNumber;
        });
      }, () => {
        const event = new Event(stream, '$liveReached');
        handler.do(handler => handler(event));
      }, () => {
        if (subscription._dropData.reason == 'userInitiated') {
          this.close();
        } else {
          subscription.stop();
          fx.snap('connection lost');
        }
      }, this.credentials);
      return subscription;
    });
  }

  tweak(stream, version, metadata) {
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

  publish(stream, version, events) {
    const esEvents = events.map(event => {
      return ES.createJsonEventData(uuid.v4(), event.eventData, event.eventMeta, event.eventType);
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

  last(stream, count) {
    return this.connection.do(async connection => {
      return (await connection.readStreamEventsBackward(stream, -1, count, true, this.credentials))
        .events.map(data => new ESEvent(data.event));
    });
  }

}
