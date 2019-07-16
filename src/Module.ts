import * as Component from './Component';

import * as Bus        from './Bus';

import * as CH         from './CommandHandler';
import * as Gateway    from './Gateway';
import * as Repository from './Repository';
import * as Factory    from './Factory';

import { command }     from './command';
import { query }       from './query';
import { reply }       from './reply';
import { event }       from './event';
import { state }       from './state';

export interface props extends Component.props {}

export interface children extends Component.children {
  CommandHandler?: { new (p: CH.props, c: CH.children): CH.CommandHandler };
  Repository?:     { new (p: Repository.props, c: Repository.children): Repository.Repository };
  Gateway?:        { new (p: Gateway.props, c: Gateway.children): Gateway.Gateway };
  events?:         { [name: string]: { new (data: any): any } }
  commands?:       { [name: string]: { new (data: any): any } }
  state?:          { [name: string]: { new (data: any): any } }
  queries?:        { [name: string]: { new (data: any): any } }
  replies?:        { [name: string]: { new (data: any): any } }
}

export class Module extends Component.Component {
  protected commandHandler: CH.CommandHandler;
  protected repository:     Repository.Repository;
  protected gateway:        Gateway.Gateway;

  constructor(props: props, children: children) {
    const color = 'CommandHandler' in children ? 'magenta'
      : 'Repository' in children ? 'cyan'
      : 'Gateway' in children ? 'yellow'
      : 'white';
    super({ color, ...props }, children);
    if (props.disabled) return ;
    const { commands, events, queries, replies, state } = children;
    if ('CommandHandler' in children) {
      this.commandHandler = this.sprout('CommandHandler', CH, { bus: props.bus, events, commands, state });
    }
    if ('Repository' in children) {
      const extra = { bus: props.bus, events, queries, replies, state };
      this.repository = this.sprout('Repository', Repository, extra);
    }
    if ('Gateway' in children) {
      this.gateway = this.sprout('Gateway', Gateway, { bus: props.bus, events, state });
    }
  }

  public async start() {
    if (this.commandHandler) await this.commandHandler.start();
    if (this.repository) await this.repository.start();
    if (this.gateway) await this.gateway.start();
    return true;
  }

  public async stop() {
    if (this.commandHandler) await this.commandHandler.stop();
    if (this.repository) await this.repository.stop();
    if (this.gateway) await this.gateway.stop();
    return ;
  }

}
