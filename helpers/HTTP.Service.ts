import * as Service         from '../sources/Service';
import { Event }            from '../sources/Event';
import { merge }            from 'cqes-util';
import { TypeError }        from 'cqes-type';

import * as events          from 'events';
import * as NodeHttp        from 'http';
import * as NodeUrl         from 'url';
import * as Express         from 'express';
import * as BodyParser      from 'body-parser';
import * as cors            from 'cors';
import * as fs              from 'fs';
import * as os              from 'os';
import * as path            from 'path';
import * as mkdirp          from 'mkdirp';

export interface Cases { [eventType: string]: [number, string] };
export interface Attachments { [name: string]: AttachmentFile };
export interface AttachmentFile {
  name:         string;
  filepath:     string;
  head:         Buffer;
  size:         number;
  headers:      { [name: string]: string | Array<string> };
  disposition:  { [name: string]: string };
  stream?:      fs.WriteStream;
}
export interface Request<T = any> extends NodeHttp.ClientRequest {
  url:              string;
  method:           string;
  query:            T;
  headers:          { [name: string]: string };
  body:             T;
  remoteAddress:    string;
  readable:         boolean;
  storeAttachments: (path?: string) => Promise<Attachments>;
};
export interface Response extends NodeHttp.ServerResponse {
  req: Request;
};

export class AccessError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
};

const CRLF = '\r\n';

interface headers { [key: string]: string | number };

interface respondOptions {
  type:      'json' | 'buffer' | 'file';
  code?:     number;
  headers?:  headers;
  data?:     any;
  wrap?:     boolean;
  filepath?: string;
  buffer?:   Buffer;
}

interface sseOptions {}

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
    headers?:   { [name: string]: string };
    uploadDir?: string;
    headSize?:  number;
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
      req.remoteAddress    = this.extractRemoteAddress(req);
      req.storeAttachments = this.makeAttachmentsStorable(req);
      try {
        return await (<any>this)[handlerName](req, res);
      } catch (e) {
        if (e instanceof AccessError) {
          this.logger.warn('AccessError (%s) %s %s', e.statusCode, handlerName, e.message);
          return this.respond(res, e.statusCode, e.message);
        } else {
          this.respondServerError(res, e);
          throw e;
        }
      }
    } else {
      this.logger.log('%red %yellow %s %j', 'Reject', req.method, req.url, req.body);
      res.writeHead(404, this.headers)
      res.end('{"message":"Endpoint not found"}');
    }
  }

  protected makeAttachmentsStorable(req: Request): Request['storeAttachments'] {
    // FIXME: restrict max file size
    // FIXME: restrict max request content size
    // TODO: Test multi file upload
    // TODO: filter by field matching glob syntax
    return (dirpath?: string) => new Promise(async (resolve, reject) => {
      const attachments: Attachments = {};
      const paths = [];
      paths.push(this.config.uploadDir || os.tmpdir());
      const maxHeadLength = this.config.headSize || 1024;
      if (dirpath != null) paths.push(dirpath);
      const target = path.join(...paths);
      await mkdirp(target);
      if (req.readable === false) return resolve(attachments);
      const contentType = req.headers['content-type'] || '';
      const infos = /^multipart\/form-data;\s*boundary=([^\s]+)$/i.exec(contentType);
      if (!infos) return resolve(attachments);
      const boundary = infos[1];
      let previous = Buffer.from('');
      let status = 'BEGIN_OF_TRANSACTION';
      let file: AttachmentFile = null;
      req.on('data', (chunk: Buffer) => {
        let rest = Buffer.concat([previous, chunk]);
        loop: while (true) {
          /* this.logger.debug(status); */
          switch (status) {
          case 'BEGIN_OF_TRANSACTION': {
            const offset = rest.indexOf(boundary);
            if (offset === 0) {
              rest = rest.slice(boundary.length + 2);
              status = 'BEGIN_OF_FILE';
            } else if (offset === 2 && rest.slice(0, 2).toString() === '--') {
              status = 'BEGIN_OF_FILE';
            } else {
              break loop;
            }
          } break ;
          case 'BEGIN_OF_FILE': {
            if (rest.indexOf('--' + boundary) === 0) {
              file = { name: null, head: Buffer.from(''), size: 0, filepath: null
                     , headers: {}, disposition: {}
                     };
              rest = rest.slice(2 + boundary.length + 2);
              status = 'FILE_HEADER';
            } else {
              break loop;
            }
          } break ;
          case 'FILE_HEADER': {
            const eof = rest.indexOf(CRLF);
            if (eof > 0 && eof <= 1024) {
              const header = rest.slice(0, eof).toString();
              const separator = header.indexOf(':');
              const headerName = header.slice(0, separator).toLowerCase();
              const headerValue = header.slice(separator + 1).trim();
              if (headerName in file.headers) {
                if (typeof file.headers[headerName] === 'string')
                  file.headers[headerName] = [<string>file.headers[headerName]];
                (<Array<string>>file.headers[headerName]).push(headerValue);
              } else {
                file.headers[headerName] = headerValue;
              }
              if (headerName === 'content-disposition') {
                headerValue.split(/;\s*/).forEach(part => {
                  const variable = part.indexOf('=');
                  if (variable < 1) return ;
                  const key = part.slice(0, variable);
                  const value = JSON.parse(part.slice(variable + 1));
                  switch (key) {
                  case 'name': { file.name = value; } break ;
                  default: { file.disposition[key] = value; } break ;
                  }
                });
              }
              rest = rest.slice(eof + 2);
              status = 'FILE_HEADER';
            } else if (eof === 0) {
              rest = rest.slice(eof + 2);
              status = 'FILE_CONTENT';
            } else {
              break loop;
            }
          } break ;
          case 'FILE_CONTENT': {
            if (file.stream == null) {
              attachments[file.name] = file;
              const output = path.join(target, file.name);
              this.logger.log('Storing file %s into %s', file.disposition.filename || file.name, output);
              file.filepath = output;
              file.stream = fs.createWriteStream(output);
              file.stream.on('error', (error: Error) => this.logger.error(error));
            }
            const eot = rest.indexOf('--' + boundary + '--');
            if (eot > -1) {
              if (file.size < maxHeadLength) {
                const part = rest.slice(0, Math.min(eot, maxHeadLength - file.size));
                file.head = Buffer.concat([file.head, part])
              }
              file.size += eot;
              file.stream.end(rest.slice(0, -2 + eot));
              delete file.stream;
              rest = rest.slice(eot + 2 + boundary.length + 2 + 2);
              status = 'END_OF_TRANSACTION';
            } else {
              const eof = rest.indexOf('--' + boundary);
              if (eof > -1) {
                if (file.size < maxHeadLength) {
                  const part = rest.slice(0, Math.min(eof, maxHeadLength - file.size));
                  file.head = Buffer.concat([file.head, part])
                }
                file.size += eof;
                file.stream.end(rest.slice(0, eof));
                delete file.stream;
                rest = rest.slice(-2 + eof + 2 + boundary.length + 2);
                status = 'BEGIN_OF_FILE';
              } else {
                if (rest.length > boundary.length + 6) {
                  const eoc = rest.length - (boundary.length + 6);
                  if (file.size < maxHeadLength) {
                    const part = rest.slice(0, Math.min(eoc, maxHeadLength - file.size));
                    file.head = Buffer.concat([file.head, part])
                  }
                  file.size += eoc;
                  file.stream.write(rest.slice(0, eoc));
                  rest = rest.slice(eoc);
                }
                status = 'FILE_CONTENT';
                break loop;
              }
            }
          } break ;
          default: break loop;
          }
        }
        previous = rest;
      });
      req.on('end', () => {
        return resolve(attachments);
      });
    });
  }

  protected respond(res: Response, code: any, data?: any, options?: any): Promise<void> {
    if (code && typeof code !== 'number' && typeof code.code === 'number') {
      options = code;
      code = options.code;
      data = options.data;
    }
    if (options == null) options = {};
    if (options.type == null) options.type = 'json';
    if (options.headers == null) options.headers = {};
    if (options.code == null) options.code = code;
    switch (options.type.toLowerCase()) {
    case 'json':   return this.respondJSON(res, { data, ...options });
    case 'file':   return this.respondFile(res, { filepath: data, ...options });
    case 'buffer': return this.respondBuffer(res, { buffer: data, ...options });
    default:       return this.respondServerError(res, new Error('unknown type'));
    }
  }

  protected respondJSON(res: Response, options: respondOptions): Promise<void> {
    if (options.wrap == null) options.wrap = true;
    const { code, headers, data } = options;
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
    return new Promise(resolve => { res.on('close', resolve); });
  }

  protected respondFile(res: Response, options: respondOptions): Promise<void> {
    const { code, headers, filepath } = options;
    return new Promise(resolve => {
      res.on('close', resolve);
      fs.lstat(filepath, (err, stat) => {
        if (err) {
          res.writeHead(404, headers);
          res.end();
        } else {
          const cachedTs = res.req.headers['if-modified-since'] != null
            ? new Date(res.req.headers['if-modified-since']).getTime()
            : null;
          if (cachedTs != null && stat.mtime.getTime() - cachedTs < 1000) {
            res.writeHead(304, headers);
            res.end();
          } else {
            headers['Content-Length'] = stat.size;
            headers['Last-Modified'] = [ dayNumberToString[stat.mtime.getDay()]
                                       , ', ', String(stat.mtime.getDate()).padStart(2, '0')
                                       , ' ',  monthNumberToString[stat.mtime.getMonth()]
                                       , ' ',  String(stat.mtime.getFullYear())
                                       , ' ',  String(stat.mtime.getHours()).padStart(2, '0')
                                       , ':',  String(stat.mtime.getMinutes()).padStart(2, '0')
                                       , ':',  String(stat.mtime.getSeconds()).padStart(2, '0')
                                       , ' GMT'
                                       ].join('');
            res.writeHead(code, headers);
            const stream = fs.createReadStream(filepath)
            const startingTransfertAt = Date.now();
            stream.on('close', () => {
              const duration = Date.now() - startingTransfertAt;
              this.logger.log('Serving file (%s bytes) %s in %sms', stat.size, filepath, duration);
            });
            stream.pipe(res);
          }
        }
      });
    });
  }

  protected respondBuffer(res: Response, options: respondOptions): Promise<void> {
    const { code, headers, buffer } = options;
    let contentLengthMissing = true;
    for (const key in headers) {
      if (key.toLowerCase() === 'content-length') {
        contentLengthMissing = false;
        break ;
      }
    }
    if (contentLengthMissing) headers['Content-Length'] = buffer.length;
    res.writeHead(code, headers);
    res.end(buffer);
    return new Promise(resolve => { res.on('close', resolve); });
  }

  protected respondServerError(res: Response, error: Error) {
    return this.respond(res, 500, error.message);
  }

  protected createSSEChannelFromResponse(res: Response, options?: sseOptions) {
    
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

const dayNumberToString = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNumberToString = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Dec'];