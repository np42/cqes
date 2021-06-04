import * as Component       from './Component';
import { Query }            from './Query';
import { Request }          from './Request';
import { Reply }            from './Reply';
import { Typer }            from 'cqes-type';

export type queryHandler   = (query: Query)     => Promise<Reply>;
export type requestHandler = (requesy: Request) => Promise<Reply>;

export interface QueryTypes   { [name: string]: Typer };
export interface RequestTypes { [name: string]: Typer };
export interface ReplyTypes   { [name: string]: Typer };
export interface Subscription { abort: () => Promise<void> };

export interface Transport {
  start:        () => Promise<void>;
  stop:         () => Promise<void>;
  serveQuery:   (handler: queryHandler) => Promise<Subscription>;
  query:        queryHandler;
  serveRequest: (handler: requestHandler) => Promise<Subscription>;
  request:      requestHandler;
}

export interface props extends Component.props {
  transport: string;
  mode:      'client' | 'server';
  view?:     string;
  queries?:  QueryTypes;
  requests?: RequestTypes;
  replies?:  ReplyTypes;
}

export class RpcBus extends Component.Component {
  protected transport:    Transport;
  protected queries:      QueryTypes;
  protected requests:     RequestTypes;
  protected replies:      ReplyTypes;
  protected view:         string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport    = new Transport({ ...props, type: 'RpcBus.Transport' });
    this.queries      = props.queries  || {};
    this.requests     = props.requests || {};
    this.replies      = props.replies  || {};
    this.view         = props.view     || props.name;
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('Connecting to %s', this.view);
    await super.start();
    await this.transport.start();
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

  // Query
  public async serveQuery(queryHandler: queryHandler): Promise<Subscription> {
    return this.transport.serveQuery(async (query: Query) => {
      if (query.method in this.queries) {
        try { query.data = this.queries[query.method].from(query.data); }
        catch (e) { debugger; throw e; }
      }
      return queryHandler(query);
    });
  }

  public async query(method: string, data: any, meta?: any): Promise<Reply> {
    const query = new Query(this.view, method, data, meta);
    const reply = await this.callQuery(query);
    if (reply.type in this.replies) {
      try { reply.data = this.replies[reply.type].from(reply.data); }
      catch (e) { debugger; throw e; }
    }
    return reply;
  }

  public callQuery(query: Query): Promise<Reply> {
    if (query.method in this.queries) query.data = this.queries[query.method].from(query.data);
    return this.transport.query(query);
  }

  // Request
  public async serveRequest(requestHandler: requestHandler): Promise<Subscription> {
    return this.transport.serveRequest(async (request: Request) => {
      if (request.method in this.requests) {
        try { request.data = this.requests[request.method].from(request.data); }
        catch (e) { debugger; throw e; }
      }
      return requestHandler(request);
    });
  }

  public async request(method: string, data: any, meta?: any): Promise<Reply> {
    const query = new Request(this.view, method, data, meta);
    const reply = await this.callRequest(query);
    if (reply.type in this.replies) {
      try { reply.data = this.replies[reply.type].from(reply.data); }
      catch (e) { debugger; throw e; }
    }
    return reply;
  }

  public callRequest(request: Request): Promise<Reply> {
    if (request.method in this.requests) request.data = this.requests[request.method].from(request.data);
    return this.transport.request(request);
  }

}
