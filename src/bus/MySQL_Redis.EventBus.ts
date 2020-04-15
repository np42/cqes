import * as Component  from '../Component';
import * as EventBus   from '../EventBus';
import { Event }       from '../Event';
import { EventNumber } from '../Event';
import { merge }       from 'cqes-util';
import * as MySQL      from 'cqes-mysql';
import * as redis      from 'redis';

export type eventHandler = EventBus.eventHandler;

export interface props extends Component.props {
  originContext?: string;
  host?:          string;
  user?:          string;
  password?:      string;
  database?:      string;
  MySQL?:         { url: string } & MySQL.props;
  Redis?:         redis.ClientOpts;
}

export class Subscription implements EventBus.Subscription {
  public    abort:    (err?: any) => Promise<void>;
  protected handler:  eventHandler;
  protected queue:    Array<Event>;
  protected draining: boolean;

  constructor(handler: eventHandler, abort: (err?: any) => Promise<void>) {
    this.queue    = [];
    this.draining = false;
    this.handler  = handler;
    this.abort    = abort;
  }

  public append(events: Array<Event>): void {
    Array.prototype.push.apply(this.queue, events);
  }

  public drain(): void {
    if (this.draining) return ;
    if (this.queue.length === 0) return ;
    this.draining = true;
    this.handler(this.queue.shift()).then(() => {
      this.draining = false;
      this.drain();
    }).catch(err => {
      this.abort(err);
    });
  }
}

export class Transport extends Component.Component implements EventBus.Transport {
  protected mysql:         MySQL.MySQL;
  protected redis:         redis.RedisClient;
  protected originContext: string;

  constructor(props: props) {
    super(props);
    if (props.MySQL == null)          props.MySQL = <any>{};
    if (props.MySQL.url != null)      props.MySQL = merge(props.MySQL, MySQL.parseURL(props.MySQL.url));
    if (props.MySQL.host == null)     props.MySQL.host = props.host || '127.0.0.1';
    if (props.MySQL.user == null)     props.MySQL.user = props.user || this.process.vars.get('profile');
    if (props.MySQL.password == null) props.MySQL.password = props.password || 'changeit';
    if (props.MySQL.database == null) props.MySQL.database = props.database || 'cqes-' + props.name.toLowerCase();
    if (props.Redis == null)          props.Redis = <any>{};
    if (props.Redis.host == null)     props.Redis.host = props.host || props.MySQL.host;
    this.mysql         = new MySQL.MySQL(this.mkprops(props.MySQL));
    this.redis         = redis.createClient(props.Redis);
    this.originContext = props.originContext || props.context;
  }

  public async start() {
    await this.mysql.start();
  }

  public async save(events: Array<Event>): Promise<void> {
    if (events.length === 0) return ;
    const query =
      [ 'INSERT INTO `@events`'
      ,   '(`category`, `streamId`, `number`, `type`, `date`, `time`, `data`, `meta`)'
      , 'VALUES '
      ].join(' ');
    const params  = <Array<any>>[];
    const rows    = <Array<any>>[];
    const date    = new Date();
    const isodate = date.toISOString();
    events.forEach((event, offset) => {
      if (event.meta?.$persistent === false) return ;
      const number = event.number === EventNumber.Append ? null : event.number;
      rows.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      params.push( event.category, event.streamId, number, event.type
                 , isodate.substr(0, 10), isodate.substr(11, 12)
                 , JSON.stringify(event.data), JSON.stringify(event.meta)
                 );
    });
    // Will throws an error on duplicate key
    if (rows.length > 0) {
      const result = <any>await this.mysql.request(query + rows.join(', '), params);
      events.forEach((event, offset) => {
        if (event.meta?.$persistent !== false) {
          event.position = result.insertId + offset
          event.meta = Object.assign(event.meta || {}, { savedAt: date });
        }
      });
    }
    const context  = this.context;
    const category = events[0].category;
    const channel  = '/' + context + '/' + category;
    this.redis.publish(channel, JSON.stringify(events));
  }

  public readFrom(category: string, id: string, number: number, handler: eventHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mysql.getConnection((err, connection) => {
        if (err) return reject(err);
        const query =
          [ 'SELECT `eventId`, `number`, `type`, `date`, `time`, `data`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `category` = ? AND `streamId` = ? AND `number` >= ?'
          , 'ORDER BY `number` ASC'
          ].join(' ');
        const request = connection.query(query, [category, id, number])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            reject(err)
          })
          .on('result', async row => {
            connection.pause()
            const data = JSON.parse(row.data);
            const meta = { savedAt: new Date(row.date + ' ' + row.time), ...JSON.parse(row.meta) };
            const event = new Event(category, id, row.number, row.type, data, meta);
            event.position = row.eventId;
            try { await handler(event); }
            catch (e) { connection.destroy(); return reject(e); }
            connection.resume();
          })
          .on('end', () => {
            this.logger.log(request.sql);
            connection.release();
            resolve()
          });
      });
    });
  }

  public async readLast(category: string, id: string, count: number): Promise<Array<Event>> {
    const sql =
      [ 'SELECT `eventId`, `number`, `type`, `date`, `time`, `data`, `meta`'
      , 'FROM `@events`'
      , 'WHERE `category` = ? AND `streamId` = ?'
      , 'ORDER BY `number` DESC'
      , 'LIMIT ?'
      ].join(' ');
    const rows = await this.mysql.request(sql, [category, id, count]);
    return rows.map(row => {
      const data = JSON.parse(row.data);
      const meta = { savedAt: new Date(row.date + ' ' + row.time), ...JSON.parse(row.meta) };
      const event = new Event(category, id, row.number, row.type, data, meta);
      event.position = row.eventId;
      return event;
    });
  }

  public subscribe(category: string, handler: eventHandler): Promise<Subscription> {
    const channel = '/' + this.originContext + '/' + category;
    const abort = (err?: Error) => {
      this.redis.unsubscribe();
      if (err) this.logger.error('Subscription %s failed', channel, err);
      else this.logger.log('Subscription %s aborted', channel);
      return Promise.resolve();
    };
    const subscription = new Subscription(handler, abort);
    this.logger.log('Subscribing %s', channel);
    this.redis.subscribe(channel);
    this.redis.on('message', (channel, message) => {
      const array = JSON.parse(message);
      if (!(array instanceof Array)) {
        this.logger.warn('Bad data received as event array:', array);
      } else {
        const events = array.map(raw => {
          const event = new Event(raw.category, raw.streamId, raw.number, raw.type, raw.data, raw.meta);
          event.position = raw.position;
          return event;
        });
        subscription.append(events);
        subscription.drain();
      }
    });
    return Promise.resolve(subscription);
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
          [ 'SELECT `eventId`, `streamId`, `number`, `type`, `date`, `time`, `data`, `meta`'
          , 'FROM `@events`'
          , 'WHERE `eventId` > ? AND `category` = ?'
          , 'ORDER BY `eventId` ASC'
          ].join(' ');
        const request = connection.query(query, [position, category])
          .on('error', err => {
            if (err && err.fatal) connection.destroy();
            else connection.release();
            this.logger.error(request.sql);
            reject(err)
          })
          .on('fields', () => {
            this.logger.log(request.sql);
          })
          .on('result', async row => {
            connection.pause();
            const data  = JSON.parse(row.data);
            const meta  = { savedAt: new Date(row.date + ' ' + row.time), ...JSON.parse(row.meta) };
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
            connection.release();
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
              if (event.meta?.$persistent === false) return ;
              await this.upsertPSubscriptionPosition(id, event.position)
            };
            return resolve(subscription);
          });
      });
    });
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

  public async stop(): Promise<void> {
    await this.mysql.stop();
    await this.redis.quit();
  }

}
