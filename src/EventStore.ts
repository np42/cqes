import * as Component from './Component';

import * as net       from 'net';
import * as fs        from 'fs';
import { createHash } from 'crypto';

export interface props extends Component.props {
  net?:     { allowHalfOpen?: boolean, pauseOnConnect?: boolean };
  address?: string | number;
  db?:      string;
};
export interface children extends Component.children {};

export enum Mode { Server = 'S', Client = 'C' };

type Payload = string | Buffer;

interface Field {
  name: string;
  type: Function;
}

// Length Stream ID revision date <payload> checksum
export interface DBIterator {
  (item: { stream: string, id: string, date: number, revision: number, payload: Payload }): void
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
  protected state:    { [name: string]: Map<string, number> };
  protected lock:     string;
  protected pending:  Array<any>;
  protected cursor:   number;

  static checksum(payload: Payload) {
    return createHash('md5').update(payload).digest('hex').substr(0, 4);
  }

  constructor(props: props, children: children) {
    if (props.address == null) props = { ...props, address: '127.0.0.1:9632' };
    if (props.db == null) props = { ...props, db: './cqes.evs' };
    super({ name: 'event', color: 'green', type: 'store', ...props }, children);
    this.state    = {};
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
    client.on('data', (chunk: Buffer) => {
      client.pause();
      const data = Buffer.concat([rest, chunk]);
      const result = this.parseChunk(REQUEST_FIELDS, data);
      result.rows.forEach(row => {
        const tid = row.id;
        switch (row.action) {
        case 'emit': {
          const data = this.parseChunk(EVENT_FIELDS, Buffer.concat([row.payload, EOL]));
          data.rows.forEach(row => {
            this.writeDB(row.stream, row.id, row.revision, row.payload)
              .then(offset => {
                const response = this.createResponseChunk(tid, 'resolve', JSON.stringify({ offset }));
                client.write(Buffer.concat([response, EOL]));
              }).catch(e => {
                const response = this.createResponseChunk(tid, 'reject', e.toString());
                client.write(Buffer.concat([response, EOL]));
              });
          });
        } break ;
        }
      });
      rest = result.rest;
      client.resume();
    });
    client.on('end', () => {
      rest = EMPTY;
      
    });
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

  protected sendClient(stream: string, id: string, revision: number, payload: Payload) {
    return new Promise((resolve, reject) => {
      const tid = String(Math.random() + Math.random() * Math.random()).substr(2, 4);
      const action  = 'emit';
      const events  = this.createEventChunk(stream, id, revision, payload);
      const transac = this.createRequestChunk(tid, action, events);
      this.sessions.set(tid, { date: Date.now(), resolve, reject });
      this.client.write(Buffer.concat([transac, EOL]));
    });
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
    const { count, rest } = await this.readDB(({ stream, id, revision, date, payload }) => {
      try { this.applyDBEvent(stream, id, revision, payload); }
      catch (e) { this.logger.warn(e.toString()); }
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

  protected readDB(iterator: DBIterator): Promise<{ count: number, rest: number }> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.props.db);
      let count = 0;
      let rest = EMPTY;
      stream.on('data', (chunk: Buffer) => {
        count += chunk.length;
        stream.pause();
        const data = Buffer.concat([rest, chunk]);
        const result = this.parseChunk(EVENT_FIELDS, data);
        result.rows.forEach(iterator);
        rest = result.rest;
        stream.resume();
      });
      stream.on('error', error => {
        this.logger.error('Failed to load Database:', error);
      });
      stream.on('close', () => {
        resolve({ count: count - rest.length, rest: rest.length });
      });
    });
  }

  protected applyDBEvent(stream: string, id: string, revision: number, payload: Payload) {
    if (!(stream in this.state)) {
      this.logger.log('Discover stream: %s', stream);
      this.state[stream] = new Map();
    }
    const items = this.state[stream];
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
        throw new Error('Bad revision, expected ' + expectedRevision + ' got ' + revision);
      }
    }
    return items.get(id);
  }

  protected writeDB(stream: string, id: string, revision: number, payload: Payload) {
    return new Promise((resolve, reject) => {
      try { revision = this.applyDBEvent(stream, id, revision, payload); }
      catch (e) { return reject(e); }
      const chunk = Buffer.concat([this.createEventChunk(stream, id, revision, payload), EOL]);
      const size = chunk.length;
      this.db.write(chunk, () => {
        const offset = this.cursor;
        this.cursor += size;
        resolve(offset);
      });
    });
  }

  protected setDBReady() {
    this.ready = true;
    this.logger.log('DB is ready');
    this.drain();
  }

  /*******************/

  protected createChunk(fields: Array<string>, payload: Payload): Buffer {
    const data = Buffer.concat([ Buffer.from(['0000'].concat(fields).join(SEPARATOR.toString()))
                               , SEPARATOR, Buffer.from(payload), SEPARATOR
                               ]);
    const length = data.length.toString(16);
    data.write(length, 4 - length.length);
    return Buffer.concat([data, Buffer.from(EventStore.checksum(data))]);
  }

  protected createEventChunk(stream: string, id: string, revision: number, payload: Payload): Buffer {
    return this.createChunk([stream, id, String(revision), String(Date.now())], payload);
  }

  protected createRequestChunk(id: string, action: string, payload: Payload) {
    return this.createChunk([id, action], payload);
  }

  protected createResponseChunk(id: string, status: string, payload: Payload) {
    return this.createChunk([id, status], payload);
  }

  protected parseChunk(fields: Array<Field>, chunk: Buffer) {
    const rows = [];
    let cursor = 0;
    while (cursor < chunk.length) {
      if (chunk.readInt8(0) === 10) {
        cursor += 1;
        continue ;
      }
      const strlen = chunk.slice(cursor, cursor + 4).toString();
      if (strlen.length < 4) break ;
      const length = parseInt(strlen, 16);
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
      }, { offset: 5, fields: <any>{} });
      result.fields.payload = line.slice(result.offset, length - 1);
      rows.push(result.fields);
      cursor += length + CHECKSUM_LENGTH + 1;
    }
    const rest = chunk.slice(cursor);
    return { rows, rest };
  }

  /*******************/

  public emit(stream: string, id: string, expectedRevision: number, payload: Payload) {
    return new Promise((resolve, reject) => {
      if (!this.ready || this.pending.length > 0) {
        this.pending.push({ stream, id, expectedRevision, payload, resolve, reject });
      } else {
        switch (this.mode) {
        case Mode.Server: {
          return this.writeDB(stream, id, expectedRevision, payload)
            .then(resolve).catch(reject);
        } break ;
        case Mode.Client: {
          return this.sendClient(stream, id, expectedRevision, payload)
            .then(resolve).catch(reject);
        } break ;
        default: {
          
        } break ;
        }
      }
    });
  }

  protected async drain() {
    if (this.pending.length === 0) return ;
    const item = this.pending.shift();
    try {
      const result = await this.emit(item.stream, item.id, item.expectedRevision, item.payload);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.drain();
    }
  }

}