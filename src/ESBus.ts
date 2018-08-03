import { Fx, Node, Action }      from './Fx';

import { EventBus, Handler }     from './EventBus';
import { InEvent, OutEvent }     from './Event';
import { InCommand }             from './Command';
import { ESInEvent }             from './ESEvent';
import { ESInCommand }           from './ESCommand';

import { StateBus }              from './StateBus';
import { State, StateData }      from './State';
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
        connection.once('reconnecting', () => fx.failWith(new Error('Connection interrupted')));
        connection.once('closed', () => fx.failWith(new Error('Connection closed')));
        fx.on('disrupted', () => connection.close());
      });
    }, { name: 'ES.Connection' });
  }

  //-- Event
  publish(stream: string, position: number, events: Array<OutEvent<any>>) {
    const meta = {};
    const esEvents = events.map(event => {
      for (const key in event.meta)
        if (key.charAt(0) == '$')
          meta[key] = event.meta[key];
      return ES.createJsonEventData(uuid.v4(), event.data, event.meta, event.type);
    });
    return this.connection.try((connection, fx) => {
      return new Promise((resolve, reject) => {
        connection.appendToStream(stream, position, esEvents, this.credentials)
          .then((result: any) => {
            if (Object.keys(meta).length == 0) return resolve(result);
            return connection.setStreamMetadataRaw(stream, -2, meta, this.credentials)
              .then(() => resolve(result))
              .catch(e => fx.failWith(e));
          })
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
      const hasPosition = state.from >= -1 && state.from != null;
      const fn = hasPosition ? 'subscribeToStreamFrom' : 'subscribeToStream';
      const args = <Array<any>>[stream];
      if (hasPosition) args.push(state.from);
      args.push(/* resolveLinkTos */ true, /* eventAppeared */(_: any, data: any) => {
        if (data.event == null) {
          // When event deleted
          state.from = data.originalEventNumber.low;
        } else {
          // When normal event
          const event = new ESInEvent(data.event, data.originalEvent);
          fxHandler.do((handler: EventHandler) => handler(event)).then(() => {
            state.from = data.originalEventNumber.low;
          });
        }
      });
      if (hasPosition)
        args.push(/* liveProcessingStarted */ () => {
          const event = new InEvent(stream, '$liveReached');
          fxHandler.do((handler: EventHandler) => handler(event));
        });
      args.push(/* subscriptionDropped */() => {
        if ((<any>subscription)._dropData.reason == 'userInitiated') {
          fx.abort();
        } else {
          subscription.stop();
          fx.failWith(new Error('Connection lost'));
        }
      }, this.credentials);
      const subscription = connection[fn].apply(connection, args);
      return subscription;
    }, { name: 'ES.Subscriber.' + stream }).open();
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
    }, { name: 'ES.Consumer.' + topic }).open();
  }

  //-- State
  restore<D extends StateData>(StateDataClass: new (_: any) => D, process?: string): Promise<State<D>> {
    if (process == null) process = StateDataClass.name;
    return new Promise(resolve => {
      return this.last(process, 1, event => new ESInState(StateDataClass, event)).then(result => {
        if (result.length == 0) return resolve(null);
        else return resolve(result[0]);
      });
    });
  }

  save<D extends StateData>(state: State<D>) {
    const process = state.process;
    const event = new ESOutState(state);
    return this.publish(process, -2, [event]);
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
