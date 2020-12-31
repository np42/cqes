import * as Component from '../Component';
import * as StateBus  from '../StateBus';
import { State }      from '../State';
import { merge }      from 'cqes-util';
import * as MySQL     from 'cqes-mysql';

export interface props extends Component.props {
  host?:     string;
  user?:     string;
  password?: string;
  database?: string;
  MySQL:     MySQL.props;
  owner?:    string;
}

export class Transport extends Component.Component implements StateBus.Transport {
  protected mysql: MySQL.MySQL;
  protected owner: string;

  constructor(props: props) {
    super(props);
    if (props.MySQL == null)          props.MySQL = <any>{};
    if (props.MySQL.url != null)      props.MySQL = merge(props.MySQL, MySQL.parseURL(props.MySQL.url));
    if (props.MySQL.host == null)     props.MySQL.host = props.host || '127.0.0.1';
    if (props.MySQL.user == null)     props.MySQL.user = props.user || this.process.vars.get('profile');
    if (props.MySQL.password == null) props.MySQL.password = props.password || 'changeit';
    if (props.MySQL.database == null) props.MySQL.database = props.database || 'cqes-' + props.name.toLowerCase();
    this.mysql = new MySQL.MySQL(this.mkprops(props.MySQL));
    this.owner = props.owner || this.context + '.' + this.name;
  }

  public async start() {
    await this.mysql.start();
  }

  public async save(state: State) {
    const query = [ 'INSERT INTO `@states` (`owner`, `stateId`, `version`, `revision`, `data`)'
                  , 'VALUE (?, ?, @version := ?, @revision := ?, @data := ?)'
                  , 'ON DUPLICATE KEY UPDATE `version` = @version, `revision` = @revision, `data` = @data'
                  ].join(' ');
    const data = JSON.stringify(state.data, (key, value) => {
      if (typeof value != 'object') return value;
      if (value instanceof Set || value instanceof Map) return Array.from(value);
      return value;
    });
    await this.mysql.request(query, [this.owner, state.stateId, state.version, state.revision, data, data]);
  }

  public async load(id: string, version: string): Promise<State> {
    const query = [ 'SELECT `revision`, `data`'
                  , 'FROM `@states`'
                  , 'WHERE `owner` = ?'
                  ,   'AND `stateId` = ?'
                  ,   'AND `version` = ?'
                  ].join(' ');
    const result = await this.mysql.request(query, [this.owner, id, version]);
    if (result.length == 0) return null;
    const row  = result[0];
    const data = row.data ? JSON.parse(row.data) : null;
    return new State(id, row.revision, version, data);
  }

  public destroy(id: string): Promise<void> {
    const query = 'DELETE FROM `@states` WHERE `owner` = ? AND `stateId` = ?';
    return <any> this.mysql.request(query, [this.owner, id]);
  }

  public async stop(): Promise<void> {
    await this.mysql.stop();
  }

}
