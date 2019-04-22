import * as Component             from './Component';
import { PersistentSubscription } from './PersistentSubscription';

import * as net       from 'net';
import * as fs        from 'fs';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

export interface props extends Component.props {
  net?:     { allowHalfOpen?: boolean, pauseOnConnect?: boolean };
  address?: string | number;
  db?:      string;
};
export interface children extends Component.children {};

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

export class EventStore extends Component.Component {
  public    mode:     Mode;
  protected server:   net.Server;
  protected client:   net.Socket;
  protected sessions: Map<string, { date: number, resolve: any, reject: any }>
  protected db:       fs.WriteStream;
  protected ready:    boolean;
  protected streams:  { [name: string]: State };
  protected lock:     string;
  protected pending:  Array<{ type: string, payload: any, resolve: any, reject: any }>;
  protected cursor:   number;

  static checksum(payload: Buffer | string) {
    return createHash('md5').update(payload).digest('hex').substr(0, 4);
  }

  constructor(props: props, children: children) {
    if (props.address == null) props = { ...props, address: '127.0.0.1:9632' };
    if (props.db == null) props = { ...props, db: './cqes.evs' };
    super({ name: 'event', color: 'green', type: 'store', ...props }, children);
    this.streams  = {};
    this.ready    = false;
    this.pending  = [];
    this.sessions = new Map();
    process.on('exit', () => this.onExit());
    process.on('SIGINT', () => this.onExit());
  }

  public async start(): Promise<boolean> {
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
      this.ready = false;
      if (lockfile) fs.unlink(lockfile, () => resolve());
      else resolve();
    });
  }

  public async onExit() {
    await this.stop();
    process.exit();
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
          this.stallSubscription(item.stream, name);
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
    this.streams[stream].subscriptions.set(name, subscription);
    return subscription;
  }

  protected addSubscription(stream: string, handler: SubscriptionHandler) {
    this.createSubscription(stream, uuid(), handler, SubscriptionStatus.Running);
  }

  protected stallSubscription(stream: string, name: string) {
    
  }

  /*******************/

  protected async addPSubscription(name: string, stream: string, handler: SubscriptionHandler) {
    const subscription = this.createSubscription(stream, name, handler, SubscriptionStatus.Updating);
    const props = { name: this.name, type: 'psubscription', db: this.props.db, pname: name };
    subscription.persistent = new PersistentSubscription(props, {});
    await subscription.persistent.start();
    await this.updatePSubscription(subscription);
    this.logger.log('PSubscription %s ready', name);
    subscription.status = SubscriptionStatus.Running;
  }

  protected updatePSubscription(subscription: Subscription) {
    return this.readDB(async item => {
      await subscription.handler(item.id, item.revision, item.date, item.payload);
      subscription.persistent.forward(item.length);
    }, subscription.persistent.cursor);
  }

  /******************/

  protected clientConnect() {
    return new Promise((resolve, reject) => {
      if (typeof this.props.address === 'number' || /^(\/|\\)/.test(this.props.address)) {
        this.client = net.createConnection(this.props.address)
      } else if (/^(\d+\.){3}\d+:\d+$/.test(this.props.address)) {
        const [ip, port] = this.props.address.split(':');
        this.client = net.createConnection(port, ip)
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

  protected sendClient(payload: Buffer) {
    return new Promise((resolve, reject) => {
      const tid = String(Math.random() + Math.random() * Math.random()).substr(2, 4);
      const action  = 'emit';
      const transac = this.createRequestChunk(tid, action, payload);
      this.sessions.set(tid, { date: Date.now(), resolve, reject });
      this.client.write(Buffer.concat([transac, EOL]));
    });
  }

  protected sendClientEvent(stream: string, id: string, revision: number, payload: Buffer) {
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
        this.db = fs.createWriteStream(this.props.db, { flags: 'a' });
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
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.props.db, { start, autoClose: true });
      let count = 0;
      let rest = EMPTY;
      stream.on('data', async (chunk: Buffer) => {
        count += chunk.length;
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

  protected writeDB(stream: string, id: string, revision: number, payload: Buffer) {
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
    this.ready = true;
    this.logger.log('DB is ready');
    this.drain();
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

  public emit(stream: string, id: string, expectedRevision: number, payload: Buffer) {
    return new Promise((resolve, reject) => {
      if (!this.ready || this.pending.length > 0) {
        this.queue('emit', { stream, id, expectedRevision, payload }, resolve, reject);
      } else {
        switch (this.mode) {
        case Mode.Server: {
          return this.writeDB(stream, id, expectedRevision, payload)
            .then(resolve).catch(reject);
        } break ;
        case Mode.Client: {
          return this.sendClientEvent(stream, id, expectedRevision, payload)
            .then(resolve).catch(reject);
        } break ;
        default: {
          
        } break ;
        }
      }
    });
  }

  public subscribe(stream: string, handler: SubscriptionHandler) {
    return new Promise((resolve, reject) => {
      if (!this.ready || this.pending.length > 0) {
        this.queue('subscribe', { stream, handler }, resolve, reject);
      } else {
        switch (this.mode) {
        case Mode.Server: {
          this.addSubscription(stream, handler);
          return resolve();
        } break ;
        case Mode.Client: {
          
        } break ;
        default: {
          
        } break ;
        }
      }
    });
  }

  public psubscribe(name: string, stream: string, handler: SubscriptionHandler): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ready || this.pending.length > 0) {
        this.queue('psubscribe', { name, stream, handler }, resolve, reject);
      } else {
        switch (this.mode) {
        case Mode.Server: {
          return this.addPSubscription(name, stream, handler)
            .then(resolve).catch(reject);
        } break ;
        case Mode.Client: {
          
        } break ;
        default: {
          
        } break ;
        }
      }
    });
  }

  /*******************/

  protected queue(type: string, payload: any, resolve: Function, reject: Function) {
    this.pending.push({ type, payload, resolve, reject });
  }

  protected async drain() {
    if (this.pending.length === 0) return ;
    while (this.pending.length > 0) {
      const item = this.pending.shift();
      switch (item.type) {
      case 'emit': {
        const value = item.payload;
        this.emit(value.stream, value.id, value.expectedRevision, value.payload)
          .then(item.resolve).catch(item.reject);
      } break ;
      case 'subscribe': {
        const value = item.payload;
        this.subscribe(value.stream, value.handler)
          .then(item.resolve).catch(item.reject);
      } break ;
      case 'psubscribe': {
        const value = item.payload;
        this.psubscribe(value.name, value.stream, value.handler)
          .then(item.resolve).catch(item.reject);
      } break ;
      }
    }
  }

}

