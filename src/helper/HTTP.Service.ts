import * as Service         from '../Service';
import { Event }            from '../Event';
import { merge }            from 'cqes-util';
import { TypeError }        from 'cqes-type';

import * as events          from 'events';
import * as NodeHttp        from 'http';
import * as NodeUrl         from 'url';
import * as Express         from 'express';
import * as BodyParser      from 'body-parser';
import * as cors            from 'cors';
import * as fs              from 'fs';

export interface Cases { [eventType: string]: [number, string] };
export interface Request<T = any> extends NodeHttp.ClientRequest {
  url:           string;
  method:        string;
  query:         T;
  headers:       { [name: string]: string };
  body:          T;
  remoteAddress: string;
};
export interface Response extends NodeHttp.ServerResponse {};

export class AccessError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
};

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
    this.headers   = merge({ 'Content-Type': 'application/json' }, props.HTTP.headers);
  }

  public async start(): Promise<void> {
    await super.start();
    this.server.listen(this.config.port, this.config.ip, () => {
      this.logger.log('Listening to %s:%s', this.config.ip, this.config.port);
    });
  }

  protected async handleHttpRequest(req: Request, res: Response) {
    const offset = req.url.indexOf('?');
    const path   = req.url.substring(1, offset === -1 ? req.url.length : offset).split('/');
    const handlerName = [req.method, ...path].join('_');
    if (handlerName in this) {
      this.logger.log('Handle %yellow %s %j', req.method, req.url, req.body);
      req.remoteAddress = this.extractRemoteAddress(req);
      try {
        return await (<any>this)[handlerName](req, res);
      } catch (e) {
        if (e instanceof AccessError) {
          this.logger.warn('AccessError (%s) %s %s', e.statusCode, handlerName, e.message);
          return this.respond(res, e.statusCode, e.message);
        } else {
          this.respond(res, 500);
          throw e;
        }
      }
    } else {
      this.logger.log('%red %yellow %s %j', 'Reject', req.method, req.url, req.body);
      res.writeHead(404, this.headers)
      res.end('{"message":"Endpoint not found"}');
    }
  }

  protected respond(res: Response, code: number, data?: any, options?: any) {
    if (options == null) options = {};
    if (options.type == null) options.type = 'json';
    if (options.wrap == null) options.wrap = true;
    if (options.headers == null) options.headers = {};
    const headers = { ...options.headers };
    let contentLengthMissing = true;
    for (const key in headers) {
      if (key.toLowerCase() === 'content-length') {
        contentLengthMissing = false;
        break ;
      }
    }
    switch (options.type.toLowerCase()) {
    case 'json': {
      headers['content-type'] = 'application/json';
      res.writeHead(code, headers);
      if (options.wrap) {
        if (data == null || code == 204) {
          res.end();
        } else if (code < 400) {
          if (typeof data === 'string') {
            res.end(JSON.stringify({ type: 'success', message: data }));
          } else {
            res.end(JSON.stringify({ type: 'success', value: data }));
          }
        } else {
          res.end(JSON.stringify({ type: 'error', message: String(data) }));
        }
      } else {
        this.logger.todo();
      }
    } break ;
    case 'file': {
      
      if (contentLengthMissing) headers['Content-Length'] = data.length;
      res.writeHead(code, headers);
      fs.createReadStream(data).pipe(res);
    } break ;
    case 'buffer': {
      if (contentLengthMissing) headers['Content-Length'] = data.length;
      res.writeHead(code, headers);
      res.end(data);
    } break ;
    }
  }

  protected extractRemoteAddress(req: any) {
    if (!req) return null;
    if (req.headers && req.headers['x-forwarded-for']) {
      return req.headers['x-forwarded-for'].split(',').pop().trim();
    } else if (req.connection && req.connection.remoteAddress) {
      return req.connection.remoteAddress;
    } else if (req.socket && req.socket.removeAddress) {
      return req.socket.removeAddress;
    } else {
      return null;
    }
  }

}
