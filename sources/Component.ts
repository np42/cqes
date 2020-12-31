import { Logger  } from './Logger';
import { Helper  } from './Helper';
import { Process } from './Process';

export interface props {
  context:  string;
  name:     string;
  serial?:  string;
  type?:    string;
  process:  Process;
  helpers?: { [name: string]: Helper };
}

export class Component {
  readonly  context?: string;
  readonly  name:     string;
  readonly  type:     string;
  readonly  serial:   string;
  readonly  started:  boolean;
  protected process:  Process;
  protected logger:   Logger;
  protected helpers:  { [name: string]: Helper };

  constructor(props: props) {
    this.context = props.context;
    this.name    = props.name;
    this.type    = props.type || (new.target.name != props.name ? new.target.name : 'Component');
    this.serial  = props.serial || null;
    this.process = props.process;
    this.helpers = props.helpers || {};
    this.logger  = new Logger(this.fqn);
    this.started = false;
  }

  get fqn() {
    const component = this.context == null ? this.name : this.context + '.' + this.name;
    const type      = ':' + this.type;
    const serial    = this.serial != null ? ':' + this.serial : '';
    return component + type + serial;
  }

  public mkprops(props: any) {
    return { context: this.context, name: this.name, ...props };
  }

  public start(): Promise<void> {
    if (this.started === true) throw new Error(this.fqn + ' is already started');
    Object.defineProperty(this, 'started', { value: true });
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    if (this.started === false) throw new Error(this.fqn + ' is already stopped');
    Object.defineProperty(this, 'started', { value: false });
    return Promise.resolve();
  }

}
