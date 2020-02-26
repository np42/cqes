import { Logger  } from './Logger';
import { Helper  } from './Helper';
import { Process } from './Process';

export interface props {
  context?: string;
  name:     string;
  logger?:  string | Logger;
  process?: Process;
  helpers?: { [name: string]: Helper };
}

export class Component {
  readonly  context: string;
  readonly  name:    string;
  protected started: boolean;
  protected process: Process;
  protected logger:  Logger;
  protected helpers: { [name: string]: Helper };

  constructor(props: props) {
    if (typeof props.name !== 'string') throw new Error('name property is required');
    if (props.logger == null) props.logger = props.name;
    if (typeof props.logger == 'string') props.logger = new Logger(props.logger);
    this.context = props.context || '(none)';
    this.name    = props.name;
    this.logger  = props.logger;
    this.process = props.process;
    this.helpers = props.helpers || {};
    this.started = false;
  }

  public start(): Promise<void> {
    if (this.started === true) throw new Error('Already started');
    this.started = true;
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    if (this.started === false) throw new Error('Already stopped');
    this.started = false;
    return Promise.resolve();
  }

}
