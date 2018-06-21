import Logger from './Logger';

import { CommandBus, Handler as CommandHandler }  from './CommandBus';
import { QueryBus,   Handler as QueryHandler }    from './QueryBus';
import { EventBus,   Handler as EventHandler }    from './EventBus';
import { StateBus,   Handler as StateHandler }    from './StateBus';

import { InCommand, OutCommand } from './Command';
import { InQuery, OutQuery }     from './Query';
import { InEvent, OutEvent }     from './Event';
import { InState, OutState }     from './State';

import { AMQPCommandBus as xCommandBus } from './AMQPCommandBus';
import { AMQPQueryBus   as xQueryBus }   from './AMQPQueryBus';
import { ESEventBus     as xEventBus }   from './ESEventBus';
import { ESEventBus     as xStateBus }   from './ESEventBus';

import { v1 as uuidv1 } from 'uuid';
import * as URL         from 'url';

export class CQESBus {

  private config:     any;
  private logger:     any;
  private cbus:       CommandBus;
  private qbus:       QueryBus;
  private ebus:       EventBus;
  private sbus:       StateBus;

  constructor(config: any = {}, name: any = null) {
    this.config        = config;
    const ebname       = { toString: () => name + ':Bus' };
    this.logger        = new Logger(ebname, 'red');
    //--
    this.cbus = new xCommandBus(config.Commands);
    this.qbus = new xQueryBus(config.Queries);
    this.ebus = new xEventBus(config.Events);
    this.sbus = new xStateBus(config.States);
  }

}
