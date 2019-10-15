import * as Component       from './Component';
import { Query as Q }       from './Query';
import { Reply as R }       from './Reply';
import { Typer }            from './Type';

export type queryHandler = (query: Q) => Promise<R>;
export interface QueriesType { [name: string]: Typer };
export interface RepliesType { [name: string]: Typer };
export interface Subscription { abort: () => Promise<void> };

export interface props extends Component.props {
  queries: QueriesType;
  replies: RepliesType;
}

export class QueryBus extends Component.Component {
  protected queries:      QueriesType;
  protected replies:      RepliesType;
  protected subscription: Subscription;
  protected view:         string;

  constructor(props: props) {
    super({ logger: 'QueryBus:' + props.name, ...props });
    this.queries      = props.queries || {};
    this.replies      = props.replies || {};
    this.subscription = null;
    this.view         = props.name;
  }

  public start(): Promise<void> {
    return Promise.resolve();
  }

  public async serve(handler: queryHandler): Promise<Subscription> {
    return Promise.resolve(null);
  }

  public request(method: string, data: any, meta?: any): Promise<R> {
    const query = new Q(this.view, method, data, meta);
    return this.requestQuery(query);
  }

  public requestQuery(query: Q): Promise<R> {
    return Promise.resolve(null);
  }

  public stop(): Promise<void> {
    if (this.subscription == null) return Promise.resolve();
    return this.subscription.abort();
  }

}
