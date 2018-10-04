import { Logger }             from './Logger';
import { Entity }             from './Aggregate';
import * as StateHandler      from './Statehandler';

export class Service <E extends Entity>  {

  private logger: Logger;
  private bus:    CQESBus;
  private store:  Store<E>;

  constructor(Entity: EntityClass<E>) {
    this.logger  = new Logger(Entity.name, 'yellow');
    this.store   = new Store(Entity);

    this.state   = new StateHandler(Entity);
    this.event   = new EventHandler(Entity);
    this.command = new CommandHandler(Entity);
    this.query   = new QueryHandler(Entity);
  }

  connect(config: any) {
    this.bus = new CQES(config);
  }

}
