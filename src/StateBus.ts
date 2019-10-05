import * as Component from './Component';
import { State as S } from './State';
import { Typer }      from './Type';

export interface props extends Component.props {
  state: Typer;
}

export class StateBus extends Component.Component {
  protected state: Typer;

  constructor(props: props) {
    super({ logger: 'StateBus:' + props.name, ...props });
    this.state = props.state;
  }

  public set(id: string, state: S): Promise<void> {
    return Promise.resolve();
  }

  public get(id: string): Promise<S> {
    return Promise.resolve(new S(id, -1, null));
  }

}
