import * as Component from '../Component';
import * as StateBus  from '../StateBus';
import { State }      from '../State';
import * as MySQL     from 'cqes-mysql';

export interface props extends Component.props {
  MySQL: MySQL.props;
}

export class Transport extends Component.Component implements StateBus.Transport {
  protected mysql: MySQL.MySQL;

  constructor(props: props) {
    super(props);
    if (props.MySQL == null)          props.MySQL = <any>{};
    if (props.MySQL.name == null)     props.MySQL.name = props.name;
    if (props.MySQL.user == null)     props.MySQL.user = 'cqes';
    if (props.MySQL.password == null) props.MySQL.password = 'changeit';
    if (props.MySQL.database == null) props.MySQL.database = 'cqes-' + props.name.toLowerCase();
    this.mysql = new MySQL.MySQL(props.MySQL);
  }

  public async save(state: State) {
    const query = [ 'INSERT INTO `@states` (`stateId`, `revision`, `data`)'
                  , 'VALUE (?, ?, ?)'
                  , 'ON DUPLICATE KEY UPDATE `data` = ?'
                  ].join(' ');
    const data = JSON.stringify(state.data);
    await this.mysql.request(query, [state.stateId, state.revision, data, data]);
  }

  public async load(id: string): Promise<State> {
    const query = [ 'SELECT `revision`, `data` FROM `@states`'
                  , 'WHERE `stateId` = ?' ].join(' ');
    const result = await this.mysql.request(query, [id]);
    if (result.length == 0) return new State(id, -1, null);
    const row = result[0];
    const data = JSON.parse(row.payload || '{}');
    return new State(id, row.revision, data);
  }

}
