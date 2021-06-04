import * as Component         from '../Component';
import * as RpcBus            from '../RpcBus';
import { Query }              from '../Query';
import { Request }            from '../Request';
import { Reply }              from '../Reply';
import { qsencode, qsdecode } from 'cqes-util';
import * as http              from 'http';
import * as uuid              from 'uuid';

export type queryHandler   = (query: Query<any>) => Promise<Reply>;
export type requestHandler = (request: Request<any>) => Promise<Reply>;
export type Mode           = 'client' | 'server';

export interface Subscription extends RpcBus.Subscription {};
/*
interface HttpResponse     extends http.ServerResponse {};
interface HttpRequest      extends http.ClientRequest {};
*/

export interface props extends Component.props {
  mode: Mode;
  HTTP: Config
};

export interface Config {
  port:  number;
  host?: string;
};

export class Transport extends Component.Component implements RpcBus.Transport {
  protected mode:           Mode;
  protected config:         Config;
  protected server:         http.Server;
  protected queryHandler:   queryHandler;
  protected requestHandler: requestHandler;

  constructor(props: props) {
    super(props);
    this.mode = props.mode;
    this.config = props.HTTP || <any>{};
    if (this.config.port == null) throw new Error(this.name + ': Port number is required');
    if (this.config.host == null) this.config.host = '127.0.0.1';
    switch (this.mode) {
    case 'server': {
      this.query   = (query: Query)     => { throw new Error('Have to be declared as client') };
      this.request = (request: Request) => { throw new Error('Have to be declared as client') };
    } break ;
    case 'client': {
      this.serveQuery   = (handler: queryHandler)   => { throw new Error('Have to be declared as server') };
      this.serveRequest = (handler: requestHandler) => { throw new Error('Have to be declared as server') };
    } break ;
    }
  }

  public start(): Promise<void> {
    if (this.mode === 'server') {
      this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        const [_, view, method] = req.url.split(/[\/?]/);
        const meta = Object.keys(req.headers).reduce((accu: any, key: string) => {
          if (key.substring(0, 7) !== 'x-meta-') return accu;
          const value = req.headers[key];
          const field = key.substring(7).replace(/-./g, c => c.substring(1).toUpperCase());
          try { accu[field] = JSON.parse(String(value)); }
          catch (e) { accu[field] = value; }
          return accu;
        }, {});
        switch (req.method) {
        case 'GET': { // Query
          if (this.queryHandler == null) return res.destroy(null);
          const qsOffset = req.url.indexOf('?');
          const data = qsOffset < 0 ? {} : qsdecode(req.url.substring(qsOffset + 1));
          this.logger.log('Query %s %s %s', view, method, data);
          const query = new Query(view, method, data, meta);
          this.respondReply(res, this.queryHandler(query));
        } break ;
        case 'POST': { // Request
          if (this.requestHandler == null) return res.destroy(null);
          this.logger.log('Request %s %s', view, method);
          const chunks: Array<Buffer> = [];
          req.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          req.on('end', () => {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            const request = new Request(view, method, data, meta);
            this.respondReply(res, this.requestHandler(request));
          });
        } break ;
        default : {
          this.logger.log('Discard %s %s', req.method, req.url);
          if (this.requestHandler == null) return res.destroy(null);
        } break ;
        }
      });
      return new Promise(resolve => {
        this.logger.log('Listening on %s:%s', this.config.host, this.config.port);
        this.server.listen(this.config.port, this.config.host, resolve);
      });
    } else {
      this.logger.log('Linked to %s:%s', this.config.host, this.config.port);
      return Promise.resolve();
    }
  }

  public stop(): Promise<void> {
    return new Promise(resolve => this.server.close(() => resolve()));
  }

  // Query
  public serveQuery(handler: queryHandler): Promise<Subscription> {
    if (this.queryHandler != null) throw new Error('Already bound');
    this.queryHandler = handler;
    return Promise.resolve({ abort: () => this.queryHandler = null });
  }

  public query(query: Query): Promise<Reply> {
    const { view, method, data } = query;
    const { host: hostname, port } = this.config;
    const qs   = qsencode(data);
    const path = '/' + view + '/' + method + '?' + qs;
    const headers = <any>{};
    for (const key in query.meta) {
      const value = query.meta[key];
      const hKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      headers['x-meta-' + hKey] = typeof value === 'object'
        ? JSON.stringify(value) : String(value);
    }
    return new Promise((resolve, reject) => {
      const chunks = <Array<Buffer>>[];
      this.logger.log('%green.View %s:%s%s', view, hostname, port, path);
      const request = http.get(<any>{ hostname, port, path, headers }, (response: http.IncomingMessage) => {
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const payload = Buffer.concat(chunks).toString();
          switch (response.statusCode) {
          case 200:
            try {
              const value = JSON.parse(payload);
              const reply = new Reply(value.type, value.data);
              return resolve(reply);
            } catch (e) {
              return reject(e);
            }
          default: case 500:
            return reject(new Error(payload));
          }
        });
      });
      request.on('error', err => {
        const tryCount = query.meta?.tryCount || 0;
        this.logger.error('Error append %s, Query failed (%s), will retry later', err, tryCount);
        query.meta = { ...query.meta, tryCount: tryCount + 1 };
        setTimeout(() => this.request(query).then(resolve).catch(reject), 1000);
      });
    });
  }

  // Request
  public serveRequest(handler: requestHandler): Promise<Subscription> {
    if (this.requestHandler != null) throw new Error('Already bound');
    this.requestHandler = handler;
    return Promise.resolve({ abort: () => this.requestHandler = null });
  }

  public request(request: Request): Promise<Reply> {
    const { view, method, data } = request;
    const { host: hostname, port } = this.config;
    const path = '/' + view + '/' + method;
    const headers = <any>{ 'Content-Type': 'application/json' };
    for (const key in request.meta) {
      const value = request.meta[key];
      const hKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      headers['x-meta-' + hKey] = typeof value === 'object'
        ? JSON.stringify(value) : String(value);
    }
    return new Promise((resolve, reject) => {
      const chunks = <Array<Buffer>>[];
      this.logger.log('%red.View %s:%s%s', view, hostname, port, path);
      const options = { method: 'POST', hostname, port, path, headers };
      const httpRequest = http.request(<any>options, (response: http.IncomingMessage) => {
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const payload = Buffer.concat(chunks).toString();
          switch (response.statusCode) {
          case 200:
            try {
              const value = JSON.parse(payload);
              const reply = new Reply(value.type, value.data);
              return resolve(reply);
            } catch (e) {
              return reject(e);
            }
          default: case 500:
            return reject(new Error(payload));
          }
        });
      });
      httpRequest.write(JSON.stringify(data));
      httpRequest.on('error', err => {
        const tryCount = request.meta?.tryCount || 0;
        this.logger.error('Error append %s, Request failed (%s), will retry later', err, tryCount);
        request.meta = { ...request.meta, tryCount: tryCount + 1 };
        setTimeout(() => this.request(request).then(resolve).catch(reject), 1000);
      });
      httpRequest.end();
    });
  }

  // Reply

  respondReply(res: http.ServerResponse, promise: Promise<any>) {
    promise.then((reply: Reply | any) => {
      if (reply == null) reply = new Reply('nil');
      else if (reply instanceof Error) reply = new Reply(reply.constructor.name, reply.message);
      else if (!(reply instanceof Reply)) reply = new Reply(reply.constructor.name, reply);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply));
    }).catch((error: Error) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(error.toString());
    });
  }

}
