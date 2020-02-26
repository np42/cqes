import * as Component from './Component';
import { Repository } from './Repository';
import { State as S } from './State';

export interface Repositories { [name: string]: Repository };

export interface props extends Component.props {
  repositories?: Repositories;
}

export function extend(holder: any, props: props) {
  holder.repositories = props.repositories || {};

  holder.get = function (target: string, streamId: string): Promise<S> {
    const category = target;
    return this.repositories[target].get(category + '-' + streamId);
  }

}
