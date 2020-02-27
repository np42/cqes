import * as Component       from './Component';
import { Query }            from './Query';
import { Reply }            from './Reply';
import { Typer }            from 'cqes-type';

export type queryHandler = (query: Query) => Promise<Reply>;

export interface QueryTypes   { [name: string]: Typer };
export interface ReplyTypes   { [name: string]: Typer };
export interface Subscription { abort: () => Promise<void> };

export interface Transport {
  start:   () => Promise<void>;
  serve:   (handler: queryHandler) => Promise<Subscription>;
  request: queryHandler;
  stop:    () => Promise<void>;
}

export interface props extends Component.props {
  transport: string;
  mode:      'client' | 'server';
  view?:     string;
  queries?:  QueryTypes;
  replies?:  ReplyTypes;
}

export class QueryBus extends Component.Component {
  protected transport:    Transport;
  protected queries:      QueryTypes;
  protected replies:      ReplyTypes;
  protected view:         string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport    = new Transport(props);
    this.queries      = props.queries || {};
    this.replies      = props.replies || {};
    this.view         = props.view    || props.name;
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('Connecting to %s', this.view);
    await super.start();
    await this.transport.start();
  }

  public async serve(handler: queryHandler): Promise<Subscription> {
    return this.transport.serve(async (query: Query) => {
      if (query.method in this.queries) {
        try { query.data = this.queries[query.method].from(query.data); }
        catch (e) { debugger; throw e; }
      }
      return handler(query);
    });
  }

  public async request(method: string, data: any, meta?: any): Promise<Reply> {
    const query = new Query(this.view, method, data, meta);
    const reply = await this.requestQuery(query);
    if (reply.type in this.replies) {
      try { reply.data = this.replies[reply.type].from(reply.data); }
      catch (e) { debugger; throw e; }
    }
    return reply;
  }

  public requestQuery(query: Query): Promise<Reply> {
    if (query.method in this.queries) query.data = this.queries[query.method].from(query.data);
    return this.transport.request(query);
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

}
