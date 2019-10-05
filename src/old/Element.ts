import { Logger } from './Logger';

export interface props {
  context:  string;
  module?:  string;
  service?: string;
  logger:   Logger;
}

export class Element {
  protected context:  string;
  protected module?:  string;
  protected service?: string;
  protected logger:   Logger;
  protected running:  boolean;
  protected services: Set<string>;

  constructor(props: props) {
    this.context = props.context;
    if (props.module) this.module = props.module;
    if (props.service) this.service = props.service;
    this.logger  = props.logger;
    this.running = false;
    for (const key in props) {
      if (props[key] instanceof Element)
        this.registerChild(key, props[key]);
    }
  }

  public async start(): Promise<boolean> {
    this.running = true;
    if (this.services == null) return true;
    for (const serviceName of this.services)
      await this[serviceName].start();
    return true;
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.services == null) return ;
    for (const serviceName of this.services)
      await this[serviceName].stop();
  }

  public registerChild(name: string, child: Element) {
    this[name] = child;
    if (name !== 'bus' && typeof child['start'] === 'function') {
      if (this.services == null) this.services = new Set([name]);
      else this.services.add(name);
    }
  }

}
