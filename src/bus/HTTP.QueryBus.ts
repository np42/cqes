import * as Component  from '../Component';
import * as QueryBus   from '../QueryBus';
import { Query }       from '../Query';
import { Reply }       from '../Reply';
import { qsencode }    from '../util';
import * as http       from 'http';
import * as uuid       from 'uuid';

export type queryHandler  = (query: Query<any>) => Promise<Reply>;

export interface Response extends http.ServerResponse {};
export interface Request  extends http.ClientRequest {};

export interface props extends Component.props {
  mode: 'client' | 'server';
  HTTP: Config
};

export interface Config {
  port:  number;
  host?: string;
};

export class Transport extends Component.Component implements QueryBus.Transport {
  protected mode: 'client' | 'server';
  protected config: Config;

  constructor(props: props) {
    super(props);
    this.mode = props.mode;
    this.config = props.HTTP;
    if (this.config.host == null) this.config.host = '127.0.0.1';
    if (this.mode !== 'server')
      this.serve = (handler: queryHandler) => { throw new Error('Have to be declared as server') };
    if (this.mode !== 'client')
      this.request = (query: Query) => { throw new Error('Have to be declared as client') };
  }

  public start(): Promise<void> {
    
  }

  public serve(handler: queryHandler): Promise<void> {

  }

  public request(query: Query): Promise<Reply> {
    const { view, method, data, meta } = query;
    const { host, port } = this.config;
    const qs             = qsencode(data);
    const url = 'http://' + host + ':' + port + '/' + view + '/' + method + '?' + qs;
    const headers = <any>{};
    for (const key in meta) {
      const value = meta[key];
      headers['X-CQES-' + key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    return new Promise(resolve => {
      http.get(<any>{ url, headers }, (response: http.IncomingMessage) => {
        
      });
    });
  }

  public stop(): Promise<void> {
    
  }

}
