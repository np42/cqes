import Logger from './Logger';

import { CommandBus, Handler as CommandHandler }  from './CommandBus';
import { QueryBus,   Handler as QueryHandler }    from './QueryBus';
import { EventBus,   Handler as EventHandler }    from './EventBus';
import { StateBus }                               from './StateBus';

import { AMQPCommandBus as xCommandBus } from './AMQPCommandBus';
import { AMQPQueryBus   as xQueryBus }   from './AMQPQueryBus';
import { ESBus          as xEventBus }   from './ESBus';
import { ESBus          as xStateBus }   from './ESBus';

export class CQESBus {

  private config:  any;
  private logger:  any;
  public C:        CommandBus;
  public Q:        QueryBus;
  public E:        EventBus;
  public S:        StateBus;

  constructor(config: any = {}, name: any = null) {
    this.config        = config;
    const ebname       = { toString: () => name + ':Bus' };
    this.logger        = new Logger(ebname, 'red');
    //--
    this.C = new xCommandBus(config.Commands);
    this.Q = new xQueryBus(config.Queries);
    this.E = new xEventBus(config.Events);
    this.S = new xStateBus(config.States);
  }

  stop() {
    //this.C.stop();
    //this.Q.stop();
    //this.E.stop();
    //this.S.stop();
  }

}
