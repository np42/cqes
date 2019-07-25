import * as Element   from './Element';
import MySQL          from 'cqes-mysql';
import { state as S } from './state';

export interface props extends Element.props {
  mysql: MySQL;
}

export class StateBus extends Element.Element {
  protected mysql: MySQL;

  public async save(state: S) {
    const query = [ 'INSERT INTO `@states` (`streamName`, `streamId`, `revision`, `payload`)'
                  , 'VALUE (?, ?, ?, ?)'
                  , 'ON DUPLICATE KEY UPDATE `payload` = ?'
                  ].join(' ');
    const data = JSON.stringify(state.data);
    await this.mysql.request(query, [state.stream, state.id, state.revision, data, data]);
  }

  public async fetch(stream: string, id: string): Promise<S> {
    const query = [ 'SELECT `revision`, `payload` FROM `@states`'
                  , 'WHERE `streamName` = ? AND `streamId` = ?' ].join(' ');
    const result = await this.mysql.request(query, [stream, id]);
    if (result.length == 0) return new S(stream, id, -1, null);
    const row = result[0];
    const data = JSON.parse(row.payload);
    return new S(stream, id, row.revision, data);
  }

}