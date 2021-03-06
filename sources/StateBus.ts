import * as Component    from './Component';
import { State }         from './State';
import { StateRevision } from './State';
import { Typer }         from 'cqes-type';

export interface Transport {
  start:   () => Promise<void>;
  save:    (state: State) => Promise<void>;
  load:    (stateId: string, version: string) => Promise<State>;
  destroy: (stateId: string) => Promise<void>;
  stop:    () => Promise<void>;
}

export interface props extends Component.props {
  transport:  string;
  state:      Typer;
  version:    string;
}

export class StateBus extends Component.Component {
  protected transport: Transport;
  protected state:     Typer;
  protected version:   string;

  constructor(props: props) {
    super(props);
    const Transport = require(props.transport).Transport;
    if (Transport == null) throw new Error('Missing Transport from ' + props.transport);
    this.transport  = new Transport({ ...props, type: 'StateBus.Transport' });
    this.state      = props.state;
    this.version    = props.version;
  }

  public async start(): Promise<void> {
    if (this.started) return ;
    this.logger.log('is Statefull');
    try { // Test empty state
      if (this.state != null)
        this.state.from({});
    } catch (e) {
      this.logger.error('Can not create an empty state of %s', this.name);
      this.logger.fatal(e);
      return ;
    }
    await super.start();
    await this.transport.start();
  }

  public async set(state: State): Promise<void> {
    switch (state.revision) {
    case StateRevision.New: {
      // Skip
    } break ;
    case StateRevision.Delete: {
      await this.transport.destroy(state.stateId);
    } break ;
    default: {
      await this.transport.save(this.typeState(state));
    } break ;
    }
  }

  public async get(stateId: string): Promise<State> {
    const state = await this.transport.load(stateId, this.version);
    if (state == null) return this.typeState(new State(stateId, -1, this.version, null));
    return this.typeState(state);
  }

  protected typeState(state: State) {
    if (this.state != null) {
      try { state.data = this.state.from(state.data); }
      catch (e) {
        if (state.revision == -1) {
          this.logger.error(e);
          throw new Error('State must handle empty value (revision = -1)');
        } else {
          throw e;
        }
      }
    }
    return state;
  }

  public async stop(): Promise<void> {
    if (!this.started) return ;
    await this.transport.stop();
    await super.stop();
  }

}
