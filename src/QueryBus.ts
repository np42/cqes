import * as Component       from './Component';
import { Query }            from './Query';
import { Reply }            from './Reply';
import { Typer }            from './Type';

export type queryHandler = (query: Query) => Promise<Reply>;

export interface QueryTypes   { [name: string]: Typer };
export interface ReplyTypes   { [name: string]: Typer };
export interface Subscription { abort: () => Promise<void> };

export interface Transport {
  start:   () => Promise<void>;
  serve:   (handler: queryHandler) => Promise<void>;
  request: queryHandler;
  stop:    () => Promise<void>;
}

export interface props extends Component.props {
  transport: string;
  mode:      'client' | 'server';
  queries:   QueryTypes;
  replies:   ReplyTypes;
}

export class QueryBus extends Component.Component {
  protected transport:    Transport;
  protected queries:      QueryTypes;
  protected replies:      ReplyTypes;
  protected view:         string;

  constructor(props: props) {
    super({ logger: 'QueryBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport    = new Transport(props);
    this.queries      = props.queries || {};
    this.replies      = props.replies || {};
    this.view         = props.name;
  }

  public start(): Promise<void> {
    return this.transport.start();
  }

  public async serve(handler: queryHandler): Promise<Subscription> {
    return Promise.resolve(null);
  }

  public request(method: string, data: any, meta?: any): Promise<Reply> {
    const query = new Query(this.view, method, data, meta);
    return this.requestQuery(query);
  }

  public requestQuery(query: Query): Promise<Reply> {
    return this.transport.request(query);
  }

  public stop(): Promise<void> {
    return this.transport.stop();
  }

}
