import * as Element   from './Element';
import MySQL          from 'cqes-mysql';
import { event as E } from './event';

export interface props extends Element.props {
  mysql: MySQL;
}

export interface Subscription {
  abort():  void;
  handler:  EventHandler;
  queue:    Array<E>;
  draining: boolean;
}
export type EventHandler = (event: E) => Promise<void>;

export class EventBus extends Element.Element {
  protected mysql:         MySQL;
  protected subscriptions: Map<string, Array<Subscription>>;

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
      ].join(' ');
    const params = <Array<any>>[];
    const rows = <Array<any>>[];
    events.forEach(event => {
      rows.push('(?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)');
      params.push( event.stream, event.id, event.number, event.name
                 , JSON.stringify(event.data), JSON.stringify(event.meta)
                 );
    });
    if (events.length > 1) this.logger.todo('make transaction if several events');
    // Will throws an error on duplicate key
    const result = <any>await this.mysql.request(query + rows.join(', '), params);
    events.forEach((event, offset) => event.position = result.insertId + offset);
    const first = events[0];
    const subscriptions = this.subscriptions.get(first.stream);
    if (subscriptions) {
      subscriptions.forEach(subscription => {
        Array.prototype.push.apply(subscription.queue, events);
        this.drainStream(first.stream);
      });
    }
    return true;
  }

  public async readFrom(stream: string, id: string, number: number, handler: EventHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `eventId`, `number`, `eventName`, `date`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `streamName` = ? AND `streamId` = ? AND `number` > ?'
          , 'ORDER BY `number` ASC'
          ].join(' ');
        const request = connection.query(query, [stream, id, number])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', row => {
            const data = JSON.parse(row.payload);
            const meta = { createdAt: row.date, ...JSON.parse(row.meta) };
            const event = new E(stream, id, row.number, row.eventName, data, meta);
            event.position = row.eventId;
            handler(event);
          })
          .on('end', () => {
            this.logger.log(request.sql);
            connection.release();
            resolve()
          });
      });
    });
  }

  public subscribe(stream: string, handler: EventHandler): Subscription {
    const subscription: Subscription =
      { handler, queue: [], draining: false
      , abort: () => this.unsubscribe(stream, subscription.handler)
      }
    if (this.subscriptions.has(stream)) {
      this.subscriptions.get(stream).push(subscription);
    } else {
      this.subscriptions.set(stream, [subscription]);
    }
    return subscription
  }

  public unsubscribe(stream: string, handler: EventHandler): number {
    const subscriptions = this.subscriptions.get(stream);
    let removed = 0;
    for (let i = 0; i < subscriptions.length; ) {
      if (subscriptions[i].handler === handler) {
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

  protected drainStream(stream: string) {
    const subscriptions = this.subscriptions.get(stream);
    if (subscriptions == null) return ;
    subscriptions.forEach(subscription => {
      if (subscription.draining) return ;
      this.drainSubscription(subscription);
    });
  }

  protected drainSubscription(subscription: Subscription) {
    if (subscription.queue.length == 0) {
      subscription.draining = false;
    } else {
      subscription.draining = true;
      const event = subscription.queue.shift();
      subscription.handler(event).then(() => {
        this.drainSubscription(subscription);
      }).catch(e => {
        this.logger.error(e);
        subscription.abort();
      });
    }
  }

  public async psubscribe(name: string, stream: string, handler: EventHandler): Promise<Subscription> {
    this.logger.log('New %green [%s] => %s', 'Persistent Subscription', name, stream);
    return new Promise(async (resolve, reject) => {
      let position = await this.getPSubscriptionPosition(name, stream);
      const newEvents = <Array<E>>[];
      let subscriptionHandler = (event: E) => { newEvents.push(event) };
      const subscription = this.subscribe(stream, async event => subscriptionHandler(event));
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `eventId`, `streamId`, `number`, `eventName`, `date`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `eventId` > ? AND `streamName` = ?'
          , 'ORDER BY `eventID` ASC'
          ].join(' ');
        const request = connection.query(query, [position, stream])
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
            event.position = row.eventId;
            try {
              await handler(event);
              position = event.number;
              await this.upsertPSubscriptionPosition(name, stream, event.position);
              connection.resume();
            } catch (e) {
              subscription.abort();
              connection.release();
              this.logger.error(e);
              return reject(e);
            }
          })
          .on('end', async () => {
            this.logger.log(request.sql);
            while (newEvents.length > 0) {
              const event = newEvents.pop();
              if (event.number == position + 1) {
                try {
                  await handler(event);
                  position = event.number;
                  await this.upsertPSubscriptionPosition(name, stream, event.position);
                } catch (e) {
                  subscription.abort();
                  connection.release();
                  this.logger.error(e);
                  return reject(e);
                }
              }
            }
            subscriptionHandler = async event => {
              await handler(event);
              await this.upsertPSubscriptionPosition(name, stream, event.position)
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
    if (position == null) return this.logger.debugger('Can not update psubscription without position');
    const query = [ 'INSERT INTO `@subscriptions` (`subscriptionName`, `streamName`, `position`)'
                  , 'VALUES (?, ?, ?)'
                  , 'ON DUPLICATE KEY UPDATE `position` = ?'
                  ].join(' ');
    try {
      await this.mysql.request(query, [name, stream, position, position]);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
