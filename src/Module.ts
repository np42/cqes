import * as Component   from './Component';

import * as Bus         from './Bus';
import * as Debouncer   from './Debouncer';
import * as Unthrottler from './Unthrottler';
import * as Service     from './Service';

import { command }      from './command';
import { query }        from './query';
import { reply }        from './reply';

export interface props extends Component.props {
  Bus?:          Bus.props;
  Debouncer?:    Debouncer.props;
  Unthrottler?:  Unthrottler.props;
  Service?:      Service.props;
  topics?:       Array<string>;
  views?:        Array<string>;
}

export interface children extends Component.children {
  Bus?:         { new(props: Bus.props,         children: Bus.children):         Bus.Bus };
  Unthrottler?: { new(props: Unthrottler.props, children: Unthrottler.children): Unthrottler.Unthrottler };
  Debouncer?:   { new(props: Debouncer.props,   children: Debouncer.children):   Debouncer.Debouncer };
  Service?:     { new(props: Service.props,     children: Service.children):     Service.Service };
}

export class Module extends Component.Component {
  public bus:         Bus.Bus;
  public debouncer:   Debouncer.Debouncer;
  public unthrottler: Unthrottler.Unthrottler;
  public service:     Service.Service;

  constructor(props: Props, children: Children) {
    super({ type: 'module', color: 'white', ...props }, children);
    this.bus         = this.sprout('Bus',         Bus);
    this.debouncer   = this.sprout('Debouncer',   Debouncer);
    this.unthrottler = this.sprout('Unthrottler', Unthrottler);
    this.service     = this.sprout('Service',     Service, { bus: this.bus });
  }

  public async start() {
    if (await this.service.start()) {
      // Bind command topics
      const topics = this.props.topics || [this.service.name];
      topics.forEach(topic => {
        this.bus.command.listen(topic, async command => {
          if (await this.debouncer.exists(command)) {
            this.bus.command.discard(command);
          } else {
            this.service.handle(command);
          }
        });
      });
      // Bind query views
      const views = this.props.views || [this.service.name];
      views.forEach(view => {
        this.bus.query.serve(view, async query => {
          const cache = this.throttler.get(query);
          cache.get(reply => this.bus.query.reply(query, reply));
          cache.resolve(() => this.service.resolve(query));
        });
      });
      // Start bus
      return this.bus.start();
    } else {
      return false;
    }
  }

  public async stop() {
    await this.service.stop();
    await this.bus.stop();
  }

}
