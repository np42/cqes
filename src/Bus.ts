import * as Element    from './Element';
import * as CommandBus from './CommandBus';
import * as QueryBus   from './QueryBus';
import * as EventBus   from './EventBus';

import { command }     from './command';
import { query }       from './query';
import { reply }       from './reply';

export interface props extends Element.props {
  command?:     CommandBus.CommandBus;
  query?:       QueryBus.QueryBus;
  event?:       EventBus.EventBus;
  CommandBus?:  CommandBus.props;
  QueryBus?:    QueryBus.props;
  EventBus?:    EventBus.props;
}

export class Bus extends Element.Element {
  public command: CommandBus.CommandBus;
  public query:   QueryBus.QueryBus;
  public event:   EventBus.EventBus;

  constructor(props: props) {
    super(props);
    const childProps = { context: props.context, logger: props.logger };
    if (props.CommandBus)
      this.command = props.command || new CommandBus.CommandBus({ ...childProps, ...props.CommandBus });
    if (props.QueryBus)
      this.query   = props.query   || new QueryBus.QueryBus({ ...childProps, ...props.QueryBus });
    if (props.EventBus)
      this.event   = props.event   || new EventBus.EventBus({ ...childProps, ...props.EventBus });
  }

  public async start() {
    this.logger.debug('Starting QueryBus', this.context);
    if (!this.query || await this.query.start()) {
      this.logger.debug('Starting EventBus', this.context);
      if (!this.event || await this.event.start()) {
        this.logger.debug('Starting CommandBus', this.context);
        if (!this.command || await this.command.start()) {
          return true;
        } else {
          if (this.event) await this.event.stop();
          if (this.query) await this.query.stop();
        }
      } else {
        if (this.query) await this.query.stop();
      }
      return false;
    }
    return false;
  }

  public async stop() {
    if (this.command) await this.command.stop();
    if (this.event)   await this.event.stop();
    if (this.query)   await this.query.stop();
  }

}
