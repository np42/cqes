import * as Component   from './Component';

import * as Bus         from './Bus';

import * as Service     from './Service';

import * as CH          from './CommandHandler';
import * as Gateway     from './Gateway';
import * as Repository  from './Repository';
import * as Reactor     from './Reactor';
import * as Factory     from './Factory';

import { command } from './command';
import { query }   from './query';
import { reply }   from './reply';
import { event }   from './event';
import { state }   from './state';

export interface props extends Component.props {
  bus?:          Bus.Bus;
}

export interface children extends Component.children {
  Factory?:        { new (p: Factory.props, c: Factory.children): Factory.Factory };
  CommandHandler?: { new (p: CH.props, c: CH.children): CH.CommandHandler };
  Reactor?:        { new (p: Reactor.props, c: Reactor.children): Reactor.Reactor };
  Repository?:     { new (p: Repository.props, c: Repository.children): Repository.Repository };
  Gateway?:        { new (p: Gateway.props, c: Gateway.children): Gateway.Gateway };
}

export enum Type { Manager = 'manager', Repository = 'repository', Gateway = 'gateway' };

export class Module extends Component.Component {
  public bus:         Bus.Bus;
  public factory:     Factory.Factory;
  public service:     Service.Service;

  constructor(props: props, children: children) {
    switch (true) {
    case 'CommandHandler' in children: {
      super({ type: 'handler', color: 'red', ...props }, children);
      this.service = this.sprout('CommandHandler', CH, { bus: props.bus });
    } break ;
    case 'Reactor' in children: {
      super({ type: 'reactor', color: 'magenta', ...props }, children);
      this.service = this.sprout('Reactor', Reactor, { bus: props.bus });
    } break ;
    case 'Repository' in children: {
      super({ type: 'repository', color: 'blue', ...props }, children);
      this.service = this.sprout('Repository', Repository, { bus: props.bus });
    } break ;
    case 'Gateway' in children: {
      super({ type: 'gateway', color: 'yellow', ...props }, children);
      this.service = this.sprout('Gateway', Gateway, { bus: props.bus });
    } break ;
    }
    this.bus     = props.bus;
    this.factory = this.sprout('Factory', Factory);
  }

  public async start() {
    if (await this.service.start()) {
      // Bind command topics
      const topics = this.props.topics || [this.props.name];
      topics.forEach((topic: string) => {
        this.bus.command.listen(topic, async command => {
          
          
        });
      });
      // Bind query views
      const views = this.props.views || [this.props.name];
      views.forEach((view: string) => {
        this.bus.query.serve(view, async query => {
          
          
        });
      });
      // Bind events types
      const types = this.props.types || [this.props.name];
      types.forEach((type: string) => {
        this.bus.event.subscribe(type, async event => {
          
          
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
