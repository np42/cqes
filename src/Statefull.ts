import * as Connected from './Connected';
import { Repository } from './Repository';
import { State as S } from './State';

export interface Repositories { [name: string]: Repository };

export interface props extends Connected.props {
  repositories?: Repositories;
}

export class Statefull extends Connected.Connected {
  protected repositories: Repositories;

  constructor(props: props) {
    super(props);
    this.repositories = props.repositories || {};
  }

  protected get(target: string, streamId: string): Promise<S> {
    const category = target;
    return this.repositories[target].get(category + '-' + streamId);
  }

}
