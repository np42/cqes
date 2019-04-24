import { Logger }      from './Logger';

import * as Component  from './Component';
import * as CommandBus from './CommandBus';
import * as QueryBus   from './QueryBus';
import * as EventBus   from './EventBus';

import { command }     from './command';
import { query }       from './query';
import { reply }       from './reply';

export interface props extends Component.props {
  CommandBus: CommandBus.props;
  QueryBus:   QueryBus.props;
  EventBus:   EventBus.props;
}

export interface children extends Component.children {
  CommandBus?: { new(props: CommandBus.props, children: CommandBus.children): CommandBus.CommandBus };
  QueryBus?:   { new(props: QueryBus.props,   children: QueryBus.children):   QueryBus.QueryBus };
  EventBus?:   { new(props: EventBus.props,   children: EventBus.children):   EventBus.EventBus };
}

export class Bus extends Component.Component {
  public command: CommandBus.CommandBus;
  public query:   QueryBus.QueryBus;
  public event:   EventBus.EventBus;

  constructor(props: props, children: children) {
    super({ ...props, type: 'bus' }, children);
    this.command = this.sprout('CommandBus', CommandBus, { context: this.context });
    this.query   = this.sprout('QueryBus', QueryBus, { context: this.context });
    this.event   = this.sprout('EventBus', EventBus, { context: this.context });
  }

  public async start() {
    this.logger.debug('Starting QueryBus', this.context);
    if (await this.query.start()) {
      this.logger.debug('Starting EventBus', this.context);
      if (await this.event.start()) {
        this.logger.debug('Starting CommandBus', this.context);
        if (await this.command.start()) {
          return true;
        } else {
          await this.event.stop();
          await this.query.stop();
        }
      } else {
        await this.query.stop();
      }
      return false;
    }
    return false;
  }

  public async stop() {
    await this.command.stop();
    await this.event.stop();
    await this.query.stop();
  }

}
