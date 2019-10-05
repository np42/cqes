import * as Component from '../Component';
import * as EventBus  from '../EventBus';
import { Event }      from '../Event';
import * as MySQL     from 'cqes-mysql';
import * as redis     from 'redis';

export type eventHandler = EventBus.eventHandler;

export interface props extends Component.props {
  MySQL: MySQL.props;
  Redis: redis.ClientOpts;
}

export interface Subscription extends EventBus.Subscription {
  handler:  eventHandler;
  queue:    Array<Event>;
  draining: boolean;
}

export class Transport extends Component.Component implements EventBus.Transport {
  protected mysql:         MySQL.MySQL;
  protected redis:         redis.RedisClient;
  protected subscriptions: Map<string, Array<Subscription>>;

  constructor(props: props) {
    super(props);
    if (props.MySQL == null) props.MySQL = <any>{};
    if (props.MySQL.name == null) props.MySQL.name = props.name;
    if (props.MySQL.user == null) props.MySQL.user = 'cqes';
    if (props.MySQL.password == null) props.MySQL.password = 'changeit';
    if (props.MySQL.database == null) props.MySQL.database = 'cqes-' + props.name.toLowerCase();
    this.mysql = new MySQL.MySQL(props.MySQL);
    this.redis = redis.createClient(props.Redis);
    this.subscriptions = new Map();
  }

  public async save(events: Array<Event>): Promise<void> {
    if (events.length === 0) return ;
    const query =
      [ 'INSERT INTO `@events`'
      ,   '(`category`, `streamId`, `number`, `type`, `date`, `time`, `payload`, `meta`)'
      , 'VALUES '
      ].join(' ');
    const params  = <Array<any>>[];
    const rows    = <Array<any>>[];
    const date    = new Date();
    const isodate = date.toISOString();
    events.forEach(event => {
      rows.push('(?, ?, ?, ?, ?, ?, ?)');
      params.push( event.category, event.streamId, event.number, event.type
                 , isodate.substr(0, 10), isodate.substr(11, 12)
                 , JSON.stringify(event.data), JSON.stringify(event.meta)
                 );
    });
    if (events.length > 1) this.logger.todo('make transaction if several events');
    // Will throws an error on duplicate key
    const result = <any>await this.mysql.request(query + rows.join(', '), params);
    events.forEach((event, offset) => {
      event.position = result.insertId + offset
      event.meta = Object.assign(event.meta || {}, { createdAt: date });
    });
    const first = events[0];
    const subscriptions = this.subscriptions.get(first.category);
    if (subscriptions) {
      subscriptions.forEach(subscription => {
        Array.prototype.push.apply(subscription.queue, events);
        this.drainStream(first.category);
      });
    }
  }

  public readFrom(category: string, id: string, number: number, handler: eventHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `eventId`, `number`, `type`, `date`, `time`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `category` = ? AND `streamId` = ? AND `number` > ?'
          , 'ORDER BY `number` ASC'
          ].join(' ');
        const request = connection.query(query, [category, id, number])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', row => {
            const data = JSON.parse(row.payload);
            const meta = { createdAt: new Date(row.date + ' ' + row.time), ...JSON.parse(row.meta) };
            const event = new Event(category, id, row.number, row.type, data, meta);
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

  public subscribe(category: string, handler: eventHandler): Promise<Subscription> {
    const subscription: Subscription =
      { handler, queue: [], draining: false
      , abort: () => Promise.resolve(<any> this.unsubscribe(category, subscription.handler))
      }
    if (this.subscriptions.has(category)) {
      this.subscriptions.get(category).push(subscription);
    } else {
      this.subscriptions.set(category, [subscription]);
    }
    return Promise.resolve(subscription);
  }

  public unsubscribe(category: string, handler: eventHandler): number {
    const subscriptions = this.subscriptions.get(category);
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
      this.subscriptions.delete(category);
    return removed;
  }

  public async psubscribe(id: string, category: string, handler: eventHandler): Promise<Subscription> {
    this.logger.log('New %green [%s] => %s', 'Persistent Subscription', id, category);
    return new Promise(async (resolve, reject) => {
      let position = await this.getPSubscriptionPosition(id);
      const newEvents = <Array<Event>>[];
      let subscriptionHandler = (event: Event) => { newEvents.push(event) };
      const subscription = await this.subscribe(category, async event => subscriptionHandler(event));
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `eventId`, `streamId`, `number`, `type`, `date`, `time`, `payload`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `eventId` > ? AND `category` = ?'
          , 'ORDER BY `eventId` ASC'
          ].join(' ');
        const request = connection.query(query, [position, category])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', async row => {
            connection.pause();
            const data  = JSON.parse(row.payload);
            const meta  = { createdAt: new Date(row.date + ' ' + row.time), ...JSON.parse(row.meta) };
            const event = new Event(category, row.streamId, row.number, row.type, data, meta);
            event.position = row.eventId;
            try {
              await handler(event);
              position = event.number;
              await this.upsertPSubscriptionPosition(id, event.position);
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
                  await this.upsertPSubscriptionPosition(id, event.position);
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
              await this.upsertPSubscriptionPosition(id, event.position)
            };
            connection.release();
            return resolve(subscription);
          });
      });
      return resolve(subscription);
    });
  }

  protected drainStream(category: string) {
    const subscriptions = this.subscriptions.get(category);
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

  protected async getPSubscriptionPosition(subscriptionId: string): Promise<number> {
    const query = [ 'SELECT `position` FROM `@subscriptions`'
                  , 'WHERE `subscriptionId` = ?' ].join(' ');
    const result = await this.mysql.request(query, [subscriptionId]);
    if (result.length == 0) return -1;
    else return result[0].position;
  }

  protected async upsertPSubscriptionPosition(subscriptionId: string, position: number) {
    if (position == null) return this.logger.debugger('Can not update psubscription without position');
    const query = [ 'INSERT INTO `@subscriptions` (`subscriptionId`, `position`)'
                  , 'VALUES (?, ?)'
                  , 'ON DUPLICATE KEY UPDATE `position` = ?'
                  ].join(' ');
    try {
      await this.mysql.request(query, [subscriptionId, position, position]);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
