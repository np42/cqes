import { Logger } from './Logger';
import { Helper } from './Helper';

export interface props {
  name:     string;
  logger?:  string | Logger;
  helpers?: { [name: string]: Helper };
}

export class Component {
  readonly  name:    string;
  protected logger:  Logger;
  protected helpers: { [name: string]: Helper };

  constructor(props: props) {
    if (props.logger == null) props.logger = props.name;
    if (typeof props.logger == 'string') props.logger = new Logger(props.logger);
    this.name    = props.name;
    this.logger  = props.logger;
    this.helpers = props.helpers || {};
  }

  public start(): Promise<void> {
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}
