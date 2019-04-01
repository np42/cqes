import * as Component from './Component';
import { query }      from './query';
import { reply }      from './reply';

export interface props extends Component.props {}
export interface children extends Component.children {}

export class QueryBus extends Component.Component {
  constructor(props: props, children: children) {
    super(props, children);
  }

  public serve(view: string, handler: (query: query<any>) => void): void {
    return ;
  }

  public request(view: string, method: string, data: any, meta?: any): Promise<void> {
    const request = new query(view, method, data, meta);
    this.logger.log('%blue [%s] %s -> %s', 'Query', request.id, view, method);
    return Promise.resolve();
  }

  public reply(query: query<any>, reply: any): Promise<void> {
    this.logger.log('%blue [%s] %s -> %s', 'Reply', query.id, query.view, reply);
    return Promise.resolve();
  }

  //--

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}
