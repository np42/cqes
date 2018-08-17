import { CommandBus } from './CommandBus';
import { QueryBus }   from './QueryBus';
import { EventBus }   from './EventBus';
import { StateBus }   from './StateBus';

import { AMQPCommandBus as xCommandBus } from './AMQPCommandBus';
import { AMQPQueryBus   as xQueryBus }   from './AMQPQueryBus';
import { ESBus          as xEventBus }   from './ESBus';
import { ESBus          as xStateBus }   from './ESBus';

interface Options {
  Commands: string,
  Queries:  string,
  Events:   string,
  States:   string
}

export class CQESBus {

  public C:        CommandBus;
  public Q:        QueryBus;
  public E:        EventBus;
  public S:        StateBus;

  constructor(config: Options) {
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
