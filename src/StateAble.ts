import * as Component from './Component';
import { Repository } from './Repository';
import { State as S } from './State';

export interface Repositories { [name: string]: Repository };

export interface props extends Component.props {
  repositories?: Repositories;
}

export function extend(holder: any, props: props) {
  holder.repositories = props.repositories || {};

  holder.get = function <X> (type: { new (...a: any): X }, streamId: string): Promise<S<X>> {
    const category = type.name;
    return this.repositories[category].get(streamId);
  }

}
