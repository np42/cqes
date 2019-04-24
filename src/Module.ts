import * as Service    from './Service';

import * as CH         from './CommandHandler';
import * as Gateway    from './Gateway';
import * as Repository from './Repository';
import * as Factory    from './Factory';

import { command }     from './command';
import { query }       from './query';
import { reply }       from './reply';
import { event }       from './event';
import { state }       from './state';

export interface props extends Service.props {}
export interface children extends Service.children {
  CommandHandler?: { new (p: CH.props, c: CH.children): CH.CommandHandler };
  Repository?:     { new (p: Repository.props, c: Repository.children): Repository.Repository };
  Gateway?:        { new (p: Gateway.props, c: Gateway.children): Gateway.Gateway };
  events?:         { [name: string]: { new (data: any): any } }
  commands?:       { [name: string]: { new (data: any): any } }
  state?:          { [name: string]: { new (data: any): any } }
  queries?:        { [name: string]: { new (data: any): any } }
  replies?:        { [name: string]: { new (data: any): any } }
}

export enum Type { CommandHandler = 'command-handler'
                 , Repository = 'repository'
                 , Gateway = 'gateway'
                 };

export class Module extends Service.Service {
  public service:     Service.Service;

  constructor(props: props, children: children) {
    const { commands, events, queries, replies, state } = children;
    switch (true) {
    case 'CommandHandler' in children: {
      super({ type: Type.CommandHandler, color: 'magenta', ...props }, children);
      this.service = this.sprout('CommandHandler', CH, { bus: props.bus, events, commands, state });
    } break ;
    case 'Repository' in children: {
      super({ type: Type.Repository, color: 'cyan', ...props }, children);
      const extra = { bus: props.bus, events, queries, replies, state };
      this.service = this.sprout('Repository', Repository, extra);
    } break ;
    case 'Gateway' in children: {
      super({ type: Type.Gateway, color: 'yellow', ...props }, children);
      this.service = this.sprout('Gateway', Gateway, { bus: props.bus, events, state });
    } break ;
    }
  }

  public start() {
    return this.service.start();
  }

  public async stop() {
    await this.service.stop();
    await super.stop();
  }

}
