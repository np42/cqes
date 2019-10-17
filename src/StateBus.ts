import * as Component from './Component';
import { State }      from './State';
import { Typer }      from './Type';
const CachingMap      = require('caching-map');

type upgrade = (state: State) => Promise<State>;

export interface Transport {
  start: () => Promise<void>;
  save:  (state: State) => Promise<void>;
  load:  (stateId: string) => Promise<State>;
  stop:  () => Promise<void>;
}

export interface props extends Component.props {
  transport:  string;
  state:      Typer;
  cacheSize?: number;
}

export class StateBus extends Component.Component {
  protected transport: Transport;
  protected state:     Typer;
  protected cache:     Map<string, State>

  constructor(props: props) {
    super({ logger: 'StateBus:' + props.name, ...props });
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport  = new Transport(props);
    this.state      = props.state;
    this.cache      = new CachingMap({ size: props.cacheSize || 1000 });
  }

  public async set(state: State): Promise<void> {
    this.cache.set(state.stateId, state);
    await this.transport.save(state);
  }

  public async get(stateId: string, upgrade?: upgrade): Promise<State> {
    if (this.cache.has(stateId)) return this.cache.get(stateId).clone();
    let state = await this.transport.load(stateId);
    if (upgrade != null) {
      state = await upgrade(state);
      this.set(state);
    } else {
      this.cache.set(stateId, state);
    }
    return state.clone();
  }

}
