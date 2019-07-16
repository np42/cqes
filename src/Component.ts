import * as Element from './Element';
import { Bus }      from './Bus';

export interface props extends Element.props {
  bus?: Bus;
}

export class Component extends Element.Element {
  protected bus:      Bus;
  protected running:  boolean;
  protected services: Set<string>;

  constructor(props: props) {
    super(props);
    this.running = false;
    for (const key in props) {
      if (props[key] instanceof Element.Element)
        this.registerChild(key, props[key]);
    }
  }

  public registerChild(name: string, child: Element.Element) {
    this[name] = child;
    if (!(child instanceof Bus) && typeof child['start'] === 'function') {
      if (this.services == null) this.services = new Set([name]);
      else this.services.add(name);
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

}
