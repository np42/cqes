
/*
export interface props {
  Command: { bus: CommandBus }
  Query:   { bus: HTTPBus }
  Event:   { bus: MySQLBus }
  State:   { bus: MySQLBus }
}
*/






/*
import * as Element    from './Element';

import * as CommandBus from './CommandBus';
import * as QueryBus   from './QueryBus';
import * as EventBus   from './EventBus';
import * as StateBus   from './StateBus';

export interface props extends Element.props {
  command?:  CommandBus.props;
  event?:    EventBus.props;
  query?:    QueryBus.props;
  state?:    StateBus.props;
}

export class Bus extends Element.Element {
  public command: CommandBus.CommandBus;
  public query:   QueryBus.QueryBus;
  public event:   EventBus.EventBus;
  public state:   StateBus.StateBus;

  constructor(props: props) {
    super(props);
    const childProps = { context: props.context, logger: props.logger };
    this.command = new CommandBus.CommandBus({ ...childProps, ...props.command });
    this.query   = new QueryBus.QueryBus({ ...childProps, ...props.query });
    this.event   = new EventBus.EventBus({ ...childProps, ...props.event });
    this.state   = new StateBus.StateBus({ ...childProps, ...props.state });
  }

  public async start() {
    let result = true;
    if (result && this.query) {
      this.logger.debug('Starting QueryBus');
      result = await this.query.start();
    }
    if (result && this.state) {
      this.logger.debug('Starting StateBus');
      result = await this.state.start();
    }
    if (result && this.event) {
      this.logger.debug('Starting EventBus');
      result = await this.event.start();
    }
    if (result && this.command) {
      this.logger.debug('Starting CommandBus');
      result = await this.command.start();
    }
    if (!result) this.stop();
    return result;
  }

  public async stop() {
    if (this.command) await this.command.stop();
    if (this.event)   await this.event.stop();
    if (this.state)   await this.state.stop();
    if (this.query)   await this.query.stop();
  }

}
*/