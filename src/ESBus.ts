import { Fx, Node, Action }      from './Fx';

import { EventBus, Handler }     from './EventBus';
import { InEvent, OutEvent }     from './Event';
import { InCommand }             from './Command';
import { ESInEvent }             from './ESEvent';
import { ESInCommand }           from './ESCommand';

import { StateBus }              from './StateBus';
import { InState, OutState }     from './State';
import { ESInState, ESOutState } from './ESState';

import * as ES                   from 'node-eventstore-client';
import * as URL                  from 'url';
import * as uuid                 from 'uuid';

type ESConnection   = ES.EventStoreNodeConnection;
type ESSubscription = ES.EventStoreSubscription;

type SubscriptionNode = Node<ESConnection, ESSubscription>;
type EventHandler     = (event: InEvent<any>) => Promise<void>;
type CommandHandler   = (command: InCommand<any>) => Promise<void>;

type FxConnection     = Fx<any, ESConnection>;
type FxSubscription   = Fx<SubscriptionNode, ESSubscription>;
type FxEventHandler   = Fx<any, EventHandler>;
type FxCommandHandler = Fx<any, CommandHandler>;

export class ESBus implements EventBus, StateBus {

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
        connection.once('closed', () => fx.failWith(new Error('Connection closed')));
      });
    });
  }

  //-- Event
  publish(stream: string, position: number, events: Array<OutEvent<any>>) {
    const esEvents = events.map(event => {
      return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
    });
    return this.connection.try((connection, fx) => {
      return new Promise((resolve, reject) => {
        connection.appendToStream(stream, position, esEvents, this.credentials)
          .then(resolve)
          .catch(e => {
            if (e.name == 'WrongExpectedVersionError') return reject(e);
            else return fx.failWith(e);
          });
      });
    });
  }

  subscribe(stream: string, from: number, handler: Handler<InEvent<any>>) {
    const state = { from };
    const fxHandler = <FxEventHandler>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return this.connection.pipe(async (connection, fx) => {
      const subscription = connection.subscribeToStreamFrom(stream, state.from, true, (_, data) => {
        if (data.event == null) { // When event deleted
          state.from = data.originalEventNumber.low;
        } else { // When normal event
          const event = new ESInEvent(data.event);
          fxHandler.do((handler: EventHandler) => handler(event)).then(() => {
            state.from = data.originalEventNumber.low;
          });
        }
      }, () => {
        const event = new InEvent(stream, '$liveReached');
        fxHandler.do((handler: EventHandler) => handler(event));
      }, () => {
        if ((<any>subscription)._dropData.reason == 'userInitiated') {
          fx.abort();
        } else {
          subscription.stop();
          fx.failWith(new Error('Connection lost'));
        }
      }, this.credentials);
      return subscription;
    });
  }

  consume(topic: string, handler: Handler<InCommand<any>>) {
    const group  = topic.substr(0, topic.indexOf(':'));
    const stream = topic.substr(group.length + 1);
    const fxHandler = <FxCommandHandler>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return this.connection.pipe(async (connection, fx) => {
      return connection.connectToPersistentSubscription(stream, group, (sub, data) => {
        if (data.event != null) {
          const replier = (method: string) => sub[method](data);
          const command = new ESInCommand(data.event, replier);
          fxHandler.do((handler: CommandHandler) => handler(command));
        } else {
          sub.acknowledge(data);
        }
      }, (subscription) => {
        if ((<any>subscription)._dropData.reason == 'userInitiated') {
          fx.abort();
        } else {
          subscription.stop();
          fx.failWith(new Error('Connection lost'));
        }
      }, this.credentials, 1, false);
    });
  }

  //-- State
  save(process: string, position: any, failWithshot: OutState<any>) {
    return this.publish(process, -2, [new ESOutState(failWithshot)]);
  }

  restore(process: string): Promise<InState<any>> {
    return new Promise(resolve => {
      return this.last(process, 1, event => new ESInState(event)).then(result => {
        if (result.length == 0) return resolve(null);
        else return resolve(result[0]);
      });
    });
  }

  //-- helpers
  last(stream: string, count: number, wrapper?: (event: any) => any): Promise<any> {
    return this.connection.do(async connection => {
      if (wrapper == null) wrapper = event => new ESInEvent(event);
      return (await connection.readStreamEventsBackward(stream, -1, count, true, this.credentials))
        .events.map(data => wrapper(data.event)).reverse();
    });
  }

  tweak(stream: string, version: number, metadata: Object) {
    return this.connection.try((connection, fx) => {
      return new Promise((resolve, reject) => {
        connection.setStreamMetadataRaw(stream, version, metadata, this.credentials)
          .then(resolve)
          .catch(e => {
            if (e.name == 'WrongExpectedVersionError') return reject(e);
            else return fx.failWith(e);
          });
      });
    });
  }

}
