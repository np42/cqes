import * as Service         from '../Service';
import { Event }            from '../Event';
import { merge, ExpireMap } from '../util';
import { TypeError }        from '../Type';

import * as NodeHttp        from 'http';
import * as NodeUrl         from 'url';
import * as Express         from 'express';
import * as BodyParser      from 'body-parser';
import * as cors            from 'cors';
import { v1 as uuid }       from 'uuid';

export type hook = (event: Event) => boolean | void;
export interface Cases {
  [eventType: string]: [number, string]
};
export interface HookInfo {
  category:      string;
  streamId:      string;
};
export interface Request<T = any> extends NodeHttp.ClientRequest {
  url:    string;
  method: string;
  body:   T;
};
export interface Response extends NodeHttp.ServerResponse {};

export interface props extends Service.props {
  HTTP: {
    port:  number;
    ip?:   string;
    cors?: cors.CorsOptions;
    bodyParser?: {
      json?:       BodyParser.OptionsJson;
      urlencoded?: BodyParser.OptionsUrlencoded;
      raw?:        BodyParser.OptionsText;
    }
    headers?: { [name: string]: string };
  }
}

export class HTTPService extends Service.Service {
  protected config:    props['HTTP'];
  protected express:   Express.Express;
  protected server:    NodeHttp.Server;
  protected callbacks: ExpireMap<string, { hook: hook, info: HookInfo }>;
  protected headers:   { [name: string]: string };

  constructor(props: props) {
    super(props);
    if (props.HTTP == null)      props.HTTP = <any>{};
    if (props.HTTP.port == null) props.HTTP.port = 1080;
    if (props.HTTP.ip == null)   props.HTTP.ip = '127.0.0.1';
    this.config    = props.HTTP;
    this.express   = Express();
    this.express.use(cors(props.HTTP.cors));
    const bpOpt    = props.HTTP.bodyParser || {};
    this.express.use(BodyParser.json(bpOpt.json || {}));
    this.express.use(BodyParser.urlencoded({ ...(bpOpt.urlencoded || {}), extended: true }));
    this.express.use(BodyParser.raw(bpOpt.raw || {}));
    this.express.use((req: any, res: any, next: () => void) => this.handleHttpRequest(req, res));
    this.server    = NodeHttp.createServer(this.express);
    this.callbacks = new ExpireMap();
    this.callbacks.on('expired', ({ key, value: { hook, info } }) => {
      const data = { message: 'Request timed out', code: 500 };
      const meta = { transactionId: key };
      hook(new Event(info.category, info.streamId, -1, 'Error', data, meta));
    });
    this.headers   = merge({ 'Content-Type': 'application/json' }, props.HTTP.headers);
  }

  public async start(): Promise<void> {
    await super.start();
    this.server.listen(this.config.port, this.config.ip, () => {
      this.logger.log('Listening to %s:%s', this.config.ip, this.config.port);
      this.eventHandlers.any = (event: Event) => {
        const transactionId = (event.meta || {}).transactionId;
        if (transactionId == null) return Promise.resolve();
        const callback = this.callbacks.get(transactionId);
        if (callback == null) return Promise.resolve();
        let result = null;
        try { result = callback.hook(event); }
        catch (e) { this.logger.error(e); }
        if (result !== false) this.callbacks.delete(transactionId);
        return Promise.resolve();
      };
    });
  }

  protected handleHttpRequest(req: Request, res: Response) {
    const offset = req.url.indexOf('?');
    const path   = req.url.substring(1, Math.max(offset, req.url.length)).split('/');
    const handlerName = [req.method, ...path].join('_');
    if (handlerName in this) {
      this.logger.log('Handle %yellow %s %j', req.method, req.url, req.body);
      return this[handlerName](req, res);
    } else {
      this.logger.log('Reject %yellow %s %j', req.method, req.url, req.body);
      res.writeHead(404, this.headers)
      res.end('{"message":"Endpoint not found"}');
    }
  }

  protected async forward(req: Request, streamId: string, handler: hook, ttl?: number) {
    const match         = /^\/([^\/]+)\/([^\/?]+)/.exec(req.url);
    const category      = match[1];
    const order         = match[2];
    const transactionId = uuid();
    const meta          = { transactionId };
    const hook = (event: Event) => {
      const transactionId = event.meta.transactionId;
      if (event.type == 'Error') {
        this.logger.warn('Request %s Timed out %j', transactionId, event.data);
      } else {
        this.logger.log('Request %s Succeed with %s %j', transactionId, event.type, event.data);
      }
      return handler(event);
    };
    if (!(ttl > 0)) ttl = 10000;
    try {
      await this.commandBuses[category].send(streamId, order, req.body, meta);
      this.callbacks.set(transactionId, ttl, { hook, info: { category, streamId } });
    } catch (e) {
      if (e instanceof TypeError) {
        this.logger.warn('Request %s failed with\n%e', transactionId, e);
        const data = { message: e.toString(), code: 400 };
        return handler(new Event(category, streamId, -1, 'Error', data, meta));
      } else {
        this.logger.warn('Request %s failed with\n%e', transactionId, e);
        const data = { message: 'Internal server error', code: 500 };
        return handler(new Event(category, streamId, -1, 'Error', data, meta));
      }
    }
  }

  protected forwardCatch(req: Request, res: Response, streamId: string, cases: Cases, ttl?: number) {
    return this.forward(req, streamId, (event: Event) => {
      if (event.type in cases) {
        const action = cases[event.type];
        if (action instanceof Array) {
          res.writeHead(cases[event.type][0], this.headers);
          res.end(JSON.stringify({ message: cases[event.type][1] }));
        } else {
          // TODO
        }
        return true;
      } else if (event.type == 'Error') {
        res.writeHead(event.data.code || 400, this.headers);
        res.end(JSON.stringify({ message: event.data.message }));
        return true;
      } else {
        this.logger.warn('Event %s not handled', event);
        res.end('{"got":"' + event.type + '"}');
        return true;
      }
    }, ttl);
  }

}
