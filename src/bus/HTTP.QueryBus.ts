import * as Component         from '../Component';
import * as QueryBus          from '../QueryBus';
import { Query }              from '../Query';
import { Reply }              from '../Reply';
import { qsencode, qsdecode } from 'cqes-util';
import * as http              from 'http';
import * as uuid              from 'uuid';

export type queryHandler = (query: Query<any>) => Promise<Reply>;
export type Mode         = 'client' | 'server';

export interface Subscription extends QueryBus.Subscription {};
export interface Response     extends http.ServerResponse {};
export interface Request      extends http.ClientRequest {};

export interface props extends Component.props {
  mode: Mode;
  HTTP: Config
};

export interface Config {
  port:  number;
  host?: string;
};

export class Transport extends Component.Component implements QueryBus.Transport {
  protected mode:         Mode;
  protected config:       Config;
  protected server:       http.Server;
  protected queryHandler: queryHandler;

  constructor(props: props) {
    super(props);
    this.mode = props.mode;
    this.config = props.HTTP || <any>{};
    if (this.config.port == null) throw new Error(this.name + ': Port number is required');
    if (this.config.host == null) this.config.host = '127.0.0.1';
    if (this.mode !== 'server')
      this.serve = (handler: queryHandler) => { throw new Error('Have to be declared as server') };
    if (this.mode !== 'client')
      this.request = (query: Query) => { throw new Error('Have to be declared as client') };
  }

  public start(): Promise<void> {
    if (this.mode === 'server') {
      this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        if (this.queryHandler == null) return res.destroy(null);
        if (req.method !== 'GET') return res.writeHead(405), res.end();
        const [_, view, method] = req.url.split(/[\/?]/);
        const qsOffset = req.url.indexOf('?');
        const data = qsOffset < 0 ? {} : qsdecode(req.url.substring(qsOffset + 1));
        const meta = Object.keys(req.headers).reduce((accu: any, key: string) => {
          if (key.substring(0, 7) !== 'x-meta-') return accu;
          const value = req.headers[key];
          const field = key.substring(7).replace(/-./g, c => c.substring(1).toUpperCase());
          try { accu[field] = JSON.parse(String(value)); }
          catch (e) { accu[field] = value; }
          return accu;
        }, {});
        const query = new Query(view, method, data, meta);
        this.queryHandler(query).then((reply: Reply) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(reply));
        }).catch((error: Error) => {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(error.toString());
        });
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

  public serve(handler: queryHandler): Promise<Subscription> {
    if (this.queryHandler != null) throw new Error('Already bound');
    this.queryHandler = handler;
    return Promise.resolve({ abort: () => this.queryHandler = null });
  }

  public request(query: Query): Promise<Reply> {
    const { view, method, data, meta } = query;
    const { host: hostname, port } = this.config;
    const qs   = qsencode(data);
    const path = '/' + view + '/' + method + '?' + qs;
    const headers = <any>{};
    for (const key in meta) {
      const value = meta[key];
      const hKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      headers['x-meta-' + hKey] = typeof value === 'object'
        ? JSON.stringify(value) : String(value);
    }
    return new Promise((resolve, reject) => {
      const chunks = <Array<Buffer>>[];
      this.logger.log('%s.View %s:%s %s', view, hostname, port, path);
      http.get(<any>{ hostname, port, path, headers }, (response: http.IncomingMessage) => {
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
    });
  }

  public stop(): Promise<void> {
    return new Promise(resolve => this.server.close(() => resolve()));
  }

}
