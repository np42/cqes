import * as Element               from './Element';
import { PersistentSubscription } from './PersistentSubscription';
import { Queue }                  from './Queue';

import { join }       from 'path';
import * as net       from 'net';
import * as fs        from 'fs';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

// TODO: implement BTree (ex: https://github.com/oscarlab/betrfs)

export interface props extends Element.props {
  net?:     { allowHalfOpen?: boolean, pauseOnConnect?: boolean };
  address?: string;
  db?:      string;
}

export enum Mode { Server = 'S', Client = 'C' };

interface Field {
  name: string;
  type: Function;
}

interface State {
  ids: Map<string, number>;
  subscriptions: Map<string, Subscription>;
}

interface Subscription {
  handler:    SubscriptionHandler;
  status:     SubscriptionStatus;
  persistent: PersistentSubscription;
}

enum SubscriptionStatus { Updating, Running, Stalled }

export interface SubscriptionHandler {
  (id: string, revision: number, date: number, payload: Buffer): Promise<void>
}

export interface DBIterator {
  (item: DBRow): Promise<void>
}

interface DBRow {
  position?: number;
  length?:   number;
  stream:    string;
  id:        string;
  revision:  number;
  date?:     number;
  payload:   Buffer;
}

const CHECKSUM_LENGTH = 4;

const EVENT_FIELDS = [ { name: 'stream', type: String }
                     , { name: 'id', type: String }
                     , { name: 'revision', type: Number }
                     , { name: 'date', type: Number }
                     ];

const REQUEST_FIELDS = [ { name: 'id', type: String }
                       , { name: 'action', type: String }
                       ];

const RESPONSE_FIELDS = [ { name: 'id', type: String }
                        , { name: 'status', type: String }
                        ];

const EOL       = Buffer.from('\n');
const SEPARATOR = Buffer.from(' ');
const EMPTY     = Buffer.from('');

export class EventStore extends Element.Element {
  public    mode:     Mode;
  protected props:    props;
  protected server:   net.Server;
  protected client:   net.Socket;
  protected sessions: Map<string, { date: number, resolve: any, reject: any }>
  protected db:       fs.WriteStream;
  protected streams:  { [name: string]: State };
  protected lock:     string;
  protected queue:    Queue;
  protected cursor:   number;

  static checksum(payload: Buffer | string) {
    return createHash('md5').update(payload).digest('hex').substr(0, 4);
  }

  constructor(props: props) {
    if (props.db == null) props = { ...props, db: join('.', props.context, 'store') };
    super(props);
    this.props    = props;
    this.streams  = {};
    this.queue    = new Queue();
    this.sessions = new Map();
    process.on('SIGINT', () => this.onExit(false));
    process.on('exit', () => this.onExit(true));
  }

  public async start(): Promise<boolean> {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    if (this.mode != null) return true;
    await this.tryServerMode();
    await this.tryClientMode();
    if (this.mode != null) {
      return true;
    } else {
      this.logger.error('Maybe DB is locked ?');
      this.logger.error('try > rm "%s.lck"', this.props.db);
    }
  }

  public stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) this.server.close();
      if (this.client) this.client.end();
      const lockfile = this.lock;
      this.lock = null;
      this.queue.pause();
      if (lockfile) fs.unlink(lockfile, () => resolve());
      else resolve();
    });
  }

  public async onExit(exit: boolean) {
    if (exit) await this.stop();
    else process.exit();
  }

  /*******************************/

  protected async tryServerMode() {
    if (this.mode != null) return false;
    this.mode = Mode.Server;
    try {
      await this.openDB();
      this.loadDB();
      try {
        await this.serverListen();
      } catch (e) {
        this.mode = null;
      }
    } catch (e) {
      this.mode = null;
    }
  }

  protected async tryClientMode() {
    if (this.mode != null) return false;
    this.mode = Mode.Client;
    try {
      await this.clientConnect();
    } catch (e) {
      this.mode = null;
    }
  }


  /*******************************/

  protected serverListen() {
    return new Promise((resolve, reject) => {
      if (this.props.address == null) resolve();
      this.server = new net.Server(this.props.net, (client: net.Socket) => {
        this.handleClientConnection(client);
      })
      this.server.on('error', (error: Error & { code: string })  => {
        if (error.code === 'EADDRINUSE') {
          this.server = null;
          reject();
        } else {
          this.logger.error(error);
        }
      });
      this.server.on('listening', () => {
        this.logger.log('Listening to %s', this.props.address);
        resolve();
      });
      if (typeof this.props.address === 'number' || /^(\/|\\)/.test(this.props.address)) {
        this.server.listen(this.props.address);
      } else if (/^(\d+\.){3}\d+:\d+$/.test(this.props.address)) {
        const [ip, port] = this.props.address.split(':');
        this.server.listen(parseInt(port), ip);
      } else if (/^\//.test(this.props.address)) {
        this.server.listen(this.props.address);
      }
    });
  }

  protected serverClose() {
    this.server.close();
    this.server = null;
  }

  protected handleClientConnection(client: net.Socket) {
    let rest = EMPTY;
    client.on('data', async (chunk: Buffer) => {
      client.pause();
      const data = Buffer.concat([rest, chunk]);
      const result = this.parseChunk(REQUEST_FIELDS, data);
      for (let i = 0; i < result.rows.length; i += 1) {
        const row = result.rows[i];
        const tid = row.id;
        switch (row.action) {
        case 'emit': {
          const data = this.parseChunk(EVENT_FIELDS, Buffer.concat([row.payload, EOL]));
          for (let ii = 0; ii < data.rows.length; ii += 1) {
            const row = data.rows[ii];
            try {
              const position = await this.emit(row.stream, row.id, row.revision, row.payload);
              const payload = Buffer.from(JSON.stringify({ position }));
              const response = this.createResponseChunk(tid, 'resolve', payload);
              client.write(Buffer.concat([response, EOL]));
            } catch (error) {
              const payload = Buffer.from(error.toString());
              const response = this.createResponseChunk(tid, 'reject', payload);
              client.write(Buffer.concat([response, EOL]));
            }
          }
        } break ;
        }
      }
      rest = result.rest;
      client.resume();
    });
    client.on('error', (error) => {
      this.logger.warn(error);
    });
    client.on('end', () => {
      rest = EMPTY;
      
    });
  }

  /*******************************/

  protected initStream(stream: string) {
    this.streams[stream] = { ids: new Map(), subscriptions: new Map() };
  }

  protected async spreadEvent(item: DBRow) {
    if (!(item.stream in this.streams)) return this.logger.warn('Stream %s not declared', item.stream);
    const subscriptions = this.streams[item.stream].subscriptions;
    for (const [name, subscription] of subscriptions) {
      if (subscription.status === SubscriptionStatus.Running) {
        try {
          await subscription.handler(item.id, item.revision, item.date, item.payload);
          if (subscription.persistent) subscription.persistent.forward(item.length);
        } catch (e) {
          this.stallSubscription(subscription);
          this.logger.warn(e);
        }
      }
    }
  }

  protected createSubscription(
    stream: string, name: string, handler: SubscriptionHandler, status: SubscriptionStatus
  ) {
    if (!(stream in this.streams)) this.initStream(stream);
    this.logger.log('New subscription %s for %s', name, stream);
    const subscription = { handler, status, persistent: <PersistentSubscription>null };
    const subscriptions = this.streams[stream].subscriptions;
    if (subscriptions.has(name)) throw new Error('Subscription ' + name + ' already exists');
    subscriptions.set(name, subscription);
    return subscription;
  }

  protected async addSubscription(stream: string, start: number, handler: SubscriptionHandler) {
    if (start == null) start = this.cursor;
    const status = start === this.cursor ? SubscriptionStatus.Running : SubscriptionStatus.Updating;
    const subscription = this.createSubscription(stream, uuid(), handler, status);
    if (start !== this.cursor) {
      await this.readDB(async item => {
        if (this.cursor === item.position + item.length)
          subscription.status = SubscriptionStatus.Running;
        if (item.stream === stream)
          await handler(item.id, item.revision, item.date, item.payload);
      }, start);
      subscription.status = SubscriptionStatus.Running;
    }
  }

  protected stallSubscription(subscription: Subscription) {
    subscription.status = SubscriptionStatus.Stalled;
  }

  /*******************/

  protected async addPSubscription(name: string, stream: string, handler: SubscriptionHandler) {
    const subscription = this.createSubscription(stream, name, handler, SubscriptionStatus.Updating);
    const props = { context: this.context, logger: this.logger, db: this.props.db, pname: name };
    subscription.persistent = new PersistentSubscription(props);
    await subscription.persistent.start();
    if (await this.updatePSubscription(stream, subscription)) {
      this.logger.log('PSubscription %s ready', name);
      subscription.status = SubscriptionStatus.Running;
    }
  }

  protected async updatePSubscription(stream: string, subscription: Subscription): Promise<boolean> {
    if (subscription.status != SubscriptionStatus.Updating) {
      this.logger.error('Can not update psubscription on %s if not in updating state', stream);
      return false;
    }
    try {
      await this.readDB(async item => {
        if (item.stream === stream)
          await subscription.handler(item.id, item.revision, item.date, item.payload);
        subscription.persistent.forward(item.length);
      }, subscription.persistent.cursor);
      return true;
    } catch (e) {
      this.stallSubscription(subscription);
      this.logger.warn(e);
      return false;
    }
  }

  /******************/

  protected clientConnect() {
    return new Promise((resolve, reject) => {
      if (typeof this.props.address === 'number' || /^(\/|\\)/.test(this.props.address)) {
        this.client = net.createConnection(this.props.address)
      } else if (/^(\d+\.){3}\d+:\d+$/.test(this.props.address)) {
        const [ip, port] = this.props.address.split(':');
        this.client = net.createConnection(Number(port), ip)
      }
      let rest = EMPTY;
      this.client.on('connect', () => {
        this.logger.log('Connected to %s', this.props.address);
        this.setDBReady();
        resolve();
      });
      this.client.on('data', (chunk: Buffer) => {
        this.client.pause();
        const data = Buffer.concat([rest, chunk]);
        const result = this.parseChunk(RESPONSE_FIELDS, data);
        result.rows.forEach(row => {
          const session = this.sessions.get(row.id);
          if (session == null) {
            this.logger.warn('Session %s not found', row.id);
          } else {
            this.sessions.delete(row.id);
            session[row.status](row.payload.toString());
          }
        });
        this.client.resume();
      });
      this.client.on('error', error => {
        reject();
      });
      this.client.on('end', () => {
        this.handleClientClosed();
      });
    });
  }

  protected handleClientClosed() {
    
  }

  protected sendClient(payload: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const tid = String(Math.random() + Math.random() * Math.random()).substr(2, 4);
      const action  = 'emit';
      const transac = this.createRequestChunk(tid, action, payload);
      this.sessions.set(tid, { date: Date.now(), resolve, reject });
      this.client.write(Buffer.concat([transac, EOL]));
    });
  }

  protected sendClientEvent(stream: string, id: string, revision: number, payload: Buffer): Promise<number> {
    const events = this.createEventChunk(stream, id, revision, Date.now(), payload);
    return this.sendClient(events);
  }

  /*******************/

  protected openDB() {
    return new Promise((resolve, reject) => {
      const lockfile = this.props.db + '.lck';
      fs.writeFile(lockfile, String(process.pid), { flag: 'wx' }, err => {
        if (err) return reject(err);
        this.lock = lockfile;
        this.db = fs.createWriteStream(this.props.db + '.evt', { flags: 'a' });
        this.db.on('ready', () => {
          resolve();
        });
        this.db.on('error', error => {
          reject(error);
        });
      });
    });
  }

  protected async loadDB() {
    const { count, rest } = await this.readDB(row => {
      try { this.applyDBEvent(row); }
      catch (e) { this.logger.warn(e.toString()); }
      return Promise.resolve();
    });
    this.cursor = count;
    if (rest > 0) {
      this.db.write(EOL, () => {
        this.cursor += rest + 1;
        this.setDBReady();
      })
    } else {
      this.setDBReady();
    }
  }

  protected readDB(iterator: DBIterator, start?: number): Promise<{ count: number, rest: number }> {
    if (!(start >= 0)) start = 0;
    if (this.cursor > 0 && start === this.cursor) return Promise.resolve({ count: 0, rest: 0 });
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.props.db + '.evt', { start, autoClose: true });
      let count = 0;
      let rest = EMPTY;
      stream.on('data', async (chunk: Buffer) => {
        stream.pause();
        const data = Buffer.concat([rest, chunk]);
        const result = this.parseChunk(EVENT_FIELDS, data, start + count);
        try {
          for (let i = 0; i < result.rows.length; i += 1)
            await iterator(result.rows[i]);
        } catch (e) {
          stream.close();
          reject(e);
        }
        rest = result.rest;
        count += chunk.length;
        stream.resume();
      });
      stream.on('error', error => {
        this.logger.error('Failed to load Database:', error);
        reject(error);
      });
      stream.on('close', () => {
        resolve({ count: count - rest.length, rest: rest.length });
      });
    });
  }

  protected applyDBEvent({ stream, id, revision, position }: DBRow) {
    if (!(stream in this.streams)) {
      this.logger.log('Discover stream: %s', stream);
      this.initStream(stream);
    }
    const items = this.streams[stream].ids;
    const lastRevision = items.get(id);
    if (revision === -2) {
      items.delete(id);
    } else if (lastRevision == null) {
      if (revision === -1) items.set(id, 0);
      else items.set(id, revision);
    } else {
      const expectedRevision = lastRevision + 1;
      if (revision === expectedRevision) {
        items.set(id, revision);
      } else if (revision === -1) {
        items.set(id, expectedRevision);
      } else {
        const pos = position != null ? ' @' + position : '';
        throw new Error('Bad revision' + pos + ', expected ' + expectedRevision + ' got ' + revision);
      }
    }
    return items.get(id);
  }

  protected writeDB(stream: string, id: string, revision: number, payload: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      try { revision = this.applyDBEvent({ stream, id, revision, payload }); }
      catch (e) { return reject(e); }
      const date   = Date.now();
      const events = this.createEventChunk(stream, id, revision, date, payload);
      const chunk  = Buffer.concat([events, EOL]);
      const size   = chunk.length;
      this.db.write(chunk, () => {
        const position = this.cursor;
        this.cursor += size;
        resolve(position);
        this.spreadEvent({ length: size, position, stream, id, revision, date, payload });
      });
    });
  }

  protected setDBReady() {
    this.queue.resume();
    this.logger.log('DB is ready');
  }

  /*******************/

  protected createChunk(fields: Array<string>, payload: Buffer): Buffer {
    const data = Buffer.concat([ Buffer.from(['0000'].concat(fields).join(SEPARATOR.toString()))
                               , SEPARATOR, payload, SEPARATOR
                               ]);
    const length = data.length.toString(16);
    data.write(length, 4 - length.length);
    return Buffer.concat([data, Buffer.from(EventStore.checksum(data))]);
  }

    protected createEventChunk(stream: string, id: string, rev: number, date: number, payload: Buffer) {
    return this.createChunk([stream, id, String(rev), String(date)], payload);
  }

  protected createRequestChunk(id: string, action: string, payload: Buffer) {
    return this.createChunk([id, action], payload);
  }

  protected createResponseChunk(id: string, status: string, payload: Buffer) {
    return this.createChunk([id, status], payload);
  }

  protected parseChunk(fields: Array<Field>, chunk: Buffer, offset?: number) {
    const rows = [];
    if (!(offset >= 0)) offset = 0;
    let cursor = 0;
    while (cursor < chunk.length) {
      if (chunk.readInt8(0) === 10) {
        cursor += 1;
        continue ;
      }
      const strlen = chunk.slice(cursor, cursor + 4).toString();
      if (strlen.length < 4) break ;
      const length = parseInt(strlen, 16);
      const data = <any>{ position: cursor + offset, length: length + CHECKSUM_LENGTH + 1 };
      if (cursor + length + CHECKSUM_LENGTH + 1 > chunk.length) break ;
      if (isNaN(length) || length === 0) {
        const next = chunk.indexOf(EOL, cursor);
        const end = Math.min(cursor + 100, next);
        this.logger.warn('Skip line: %j', chunk.slice(cursor, end).toString());
        if (next == -1) break ;
        cursor = next + 1;
        continue ;
      }
      const line = chunk.slice(cursor, cursor + length + CHECKSUM_LENGTH + 1);
      const checksum = EventStore.checksum(line.slice(0, line.length - CHECKSUM_LENGTH - 1));
      if (checksum != line.slice(line.length - CHECKSUM_LENGTH - 1, line.length - 1).toString()) {
        const next = chunk.indexOf(EOL, cursor);
        const end = Math.min(cursor + 100, next);
        this.logger.warn('Bad checksum (expected: %s): %s', checksum, chunk.slice(cursor, end).toString());
        cursor = next + 1;
        continue ;
      }
      const result = fields.reduce((result, field) => {
        const offset = line.indexOf(' ', result.offset);
        const value = line.slice(result.offset, offset);
        result.fields[field.name] = field.type(value);
        result.offset = offset + 1;
        return result;
      }, { offset: 5, fields: data });
      cursor += length + CHECKSUM_LENGTH + 1;
      result.fields.payload = line.slice(result.offset, length - 1);
      rows.push(result.fields);
    }
    const rest = chunk.slice(cursor);
    return { rows, rest };
  }

  /*******************/

  public emit(stream: string, id: string, expectedRevision: number, payload: Buffer): Promise<number> {
    if (this.queue.running) {
      switch (this.mode) {
      case Mode.Server: return this.writeDB(stream, id, expectedRevision, payload);
      case Mode.Client: return this.sendClientEvent(stream, id, expectedRevision, payload);
      default: return Promise.reject('Unknown mode');
      }
    } else {
      return this.queue.push(this, this.emit, stream, id, expectedRevision, payload);
    }
  }

  public subscribe(stream: string, handler: SubscriptionHandler, start?: number): Promise<void> {
    if (this.queue.running) {
      switch (this.mode) {
      case Mode.Server: return this.addSubscription(stream, start, handler);
      case Mode.Client: {
        
      } break ;
      default: return Promise.reject('Unknown mode');
      }
    } else {
      return this.queue.push(this, this.subscribe, stream, handler, start);
    }
  }

  public psubscribe(name: string, stream: string, handler: SubscriptionHandler): Promise<any> {
    if (this.queue.running) {
      switch (this.mode) {
      case Mode.Server: return this.addPSubscription(name, stream, handler)
      case Mode.Client: {
        
      } break ;
      default: return Promise.reject('Unknown mode');
      }
    } else {
      return this.queue.push(this, this.psubscribe, name, stream, handler);
    }
  }

}

