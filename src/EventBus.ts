import * as Element   from './Element';
import MySQL          from 'cqes-mysql';
import { event as E } from './event';

export interface props extends Element.props {
  mysql: MySQL;
}

export type Subscription = { abort: () => void };
export type EventHandler = (event: E) => Promise<void>;

export class EventBus extends Element.Element {
  protected mysql:         MySQL;
  protected subscriptions: Map<string, Array<EventHandler>>;

  constructor(props: props) {
    super(props);
    this.subscriptions = new Map();
  }

  public async save(events: Array<E>): Promise<boolean> {
    if (events.length === 0) return true;
    const query =
      [ 'INSERT INTO `@events`'
      ,   '(`streamName`, `streamId`, `number`, `eventName`, `date`, `payload`, `meta`)'
      , 'VALUES '
      ];
    const params = <Array<any>>[];
    const rows = <Array<any>>[];
    events.forEach(event => {
      rows.push('(?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)');
      params.push( event.stream, event.id, event.number, event.name
                 , JSON.stringify(event.data), JSON.stringify(event.meta)
                 );
    });
    if (events.length > 1) this.logger.todo('make transaction if several events');
    const result = await this.mysql.request(query + rows.join(', '), params);
    debugger;
    // return false;
    const first = events[0];
    const subscription = this.subscriptions.get(first.stream);
    if (subscription) {
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        const promises = <Array<Promise<void>>>[];
        subscription.forEach(handler => {
          try {
            const promise = handler(event);
            if (promise instanceof Promise) promises.push(promise);
          } catch (e) {
            this.unsubscribe(event.stream, handler);
          }
        });
        await Promise.all(promises);
      }
    }
    return true;
  }

  public async readFrom(stream: string, id: string, number: number, handler: EventHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `number`, `eventName`, `date`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `streamName` = ? AND `streamId` = ? AND `number` > ?'
          ].join(' ');
        connection.query(query, [stream, id, number])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', row => {
            const data = JSON.parse(row.payload);
            const meta = { createdAt: row.date, ...JSON.parse(row.meta) };
            const event = new E(stream, id, row.number, row.eventName, data, meta);
            handler(event);
          })
          .on('end', () => {
            connection.release();
            resolve()
          });
      });
    });
  }

  public subscribe(stream: string, handler: EventHandler): Subscription {
    if (this.subscriptions.has(stream)) {
      this.subscriptions.get(stream).push(handler);
    } else {
      this.subscriptions.set(stream, [handler]);
    }
    return { abort: () => this.unsubscribe(stream, handler) }
  }

  public unsubscribe(stream: string, handler: EventHandler): number {
    const subscriptions = this.subscriptions.get(stream);
    let removed = 0;
    for (let i = 0; i < subscriptions.length; ) {
      if (subscriptions[i] === handler) {
        subscriptions.splice(i, 1);
        removed += 1;
      } else {
        i += 1;
      }
    }
    if (subscriptions.length === 0)
      this.subscriptions.delete(stream);
    return removed;
  }

  public async psubscribe(name: string, stream: string, handler: EventHandler): Promise<Subscription> {
    return new Promise(async (resolve, reject) => {
      let position = await this.getPSubscriptionPosition(name, stream);
      const newEvents = <Array<E>>[];
      let subscriptionHandler = (event: E) => { newEvents.push(event) };
      const subscription = this.subscribe(stream, async event => subscriptionHandler(event));
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `streamId`, `number`, `eventName`, `date`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `eventId` > ? AND `streamName` = ?'
          ].join(' ');
        connection.query(query, [position, stream])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', async row => {
            connection.pause();
            const meta = { createdAt: row.date, ...JSON.parse(row.meta) };
            const data = JSON.parse(row.payload);
            const event = new E(stream, row.streamId, row.number, row.eventName, data, meta);
            try {
              await handler(event);
              position = event.number;
              await this.upsertPSubscriptionPosition(name, stream, row.number);
              connection.resume();
            } catch (e) {
              subscription.abort();
              connection.release();
              return reject(e);
            }
          })
          .on('end', async () => {
            while (newEvents.length > 0) {
              const event = newEvents.pop();
              if (event.number == position + 1) {
                try {
                  await handler(event);
                  position = event.number;
                  await this.upsertPSubscriptionPosition(name, stream, event.number);
                } catch (e) {
                  subscription.abort();
                  connection.release();
                  return reject(e);
                }
              }
            }
            subscriptionHandler = async event => {
              await handler(event);
              await this.upsertPSubscriptionPosition(name, stream, event.number)
            };
            connection.release();
            return resolve(subscription);
          });
      });
      return resolve(subscription);
    });
  }

  protected async getPSubscriptionPosition(name: string, stream: string): Promise<number> {
    const query = [ 'SELECT `position` FROM `@subscriptions`'
                  , 'WHERE `subscriptionName` = ? AND `streamName` = ?' ].join(' ');
    const result = await this.mysql.request(query, [name, stream]);
    if (result.length == 0) return -1;
    else return result[0].position;
  }

  protected async upsertPSubscriptionPosition(name: string, stream: string, position: number) {
    const query = [ 'INSERT INTO `@subscriptions` (`subscriptionName`, `streamName`, `position`)'
                  , 'VALUES (?, ?, ?)'
                  , 'ON DUPLICATE KEY UPDATE `postion` = ?'
                  ].join(' ');
    const result = await this.mysql.request(query, [name, stream, position, position]);
    debugger;
  }
}
