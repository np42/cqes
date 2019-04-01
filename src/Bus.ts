import { Logger }      from './Logger';

import * as Component  from './Component';
import * as CommandBus from './CommandBus';
import * as QueryBus   from './QueryBus';

import { command }     from './command';
import { query }       from './query';
import { reply }       from './reply';

export interface props extends Component.props {
  CommandBus: CommandBus.props;
  QueryBus:   QueryBus.props;
}

export interface children extends Component.children {
  CommandBus: { new(props: CommandBus.props, children: CommandBus.children): CommandBus.CommandBus };
  QueryBus:   { new(props: CommandBus.props, children: CommandBus.children): CommandBus.CommandBus };
}

export class Bus extends Component.Component {
  public command: CommandBus.CommandBus;
  public query:   QueryBus.QueryBus;

  constructor(props: props, children: children) {
    super(props, children);
    this.command = this.sprout('CommandBus', CommandBus);
    this.query   = this.sprout('QueryBus', QueryBus);
  }

  public async start() {
    if (await this.query.start()) {
      if (await this.command.start()) return true;
      await this.query.stop();
      return false;
    }
    return false;
  }

  public async stop() {
    await this.command.stop();
    await this.query.stop();
  }

}
