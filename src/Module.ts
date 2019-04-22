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
}

export enum Type { CommandHandler = 'command-handler'
                 , Repository = 'repository'
                 , Gateway = 'gateway'
                 };

export class Module extends Service.Service {
  public service:     Service.Service;

  constructor(props: props, children: children) {
    switch (true) {
    case 'CommandHandler' in children: {
      super({ type: Type.CommandHandler, color: 'magenta', ...props }, children);
      this.service = this.sprout('CommandHandler', CH, { bus: props.bus });
    } break ;
    case 'Repository' in children: {
      super({ type: Type.Repository, color: 'cyan', ...props }, children);
      this.service = this.sprout('Repository', Repository, { bus: props.bus });
    } break ;
    case 'Gateway' in children: {
      super({ type: Type.Gateway, color: 'yellow', ...props }, children);
      this.service = this.sprout('Gateway', Gateway, { bus: props.bus });
    } break ;
    }
  }

  public start() {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
    return this.service.start();
  }

  public async stop() {
    await this.service.stop();
    await super.stop();
  }

}
