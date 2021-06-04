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
}

export class RpcBus extends Component.Component {
  protected transport:    Transport;
  protected queries:      QueryTypes;
  protected requests:     RequestTypes;
  protected view:         string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport    = new Transport({ ...props, type: 'RpcBus.Transport' });
    this.queries      = props.queries  || {};
    this.requests     = props.requests || {};
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
      if (!(query.method in this.queries)) throw new Error('Missing Query Method: ' + query.method);
      query.data = this.queries[query.method].from(query.data);
      return queryHandler(query);
    });
  }

  public async query(method: string, data: any, meta?: any): Promise<Reply> {
    const query = new Query(this.view, method, data, meta);
    query.data = this.queries[query.method].from(query.data);
    return this.transport.query(query);
  }

  // Request
  public async serveRequest(requestHandler: requestHandler): Promise<Subscription> {
    return this.transport.serveRequest(async (request: Request) => {
      if (!(request.method in this.requests)) throw new Error('Missing Request Method: ' + request.method)
      request.data = this.requests[request.method].from(request.data);
      return requestHandler(request);
    });
  }

  public async request(method: string, data: any, meta?: any): Promise<Reply> {
    const request = new Request(this.view, method, data, meta);
    request.data = this.requests[request.method].from(request.data);
    return this.transport.request(request);
  }

}
