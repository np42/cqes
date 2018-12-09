import * as Component                     from './Component';

import * as Debouncer                     from './Debouncer';
import * as Throttler                     from './Throttler';

import { Command, InCommand, OutCommand } from './Command';
import { Query, InQuery }                 from './Query';
import { Reply }                          from './Reply';

export interface Props extends Component.Props {
  Debouncer?: Debouncer.Props;
  Throttler?: Throttler.Props;
  Handler?:   Component.Props;
}

export interface Children extends Component.Children {
  Throttler: { new(props: Throttler.Props, children: Throttler.Children): Throttler.Throttler };
  Debouncer: { new(props: Debouncer.Props, children: Debouncer.Children): Debouncer.Debouncer };
  Handler:   { new(props: Component.Props, children: Component.Children): Handler };
}

export interface Handler {
  start:          () => Promise<boolean>;
  stop:           () => Promise<void>;
  handleCommand?: (command: Command) => Promise<Reply>;
  handleQuery?:   (query: Query) => Promise<Reply>;
}

export class Service extends Component.Component {
  public debouncer: Debouncer.Debouncer;
  public throttler: Throttler.Throttler;
  public handler:   Handler;

  constructor(props: Props, children: Children) {
    super(props, children);
    this.debouncer = this.sprout('Debouncer', Debouncer);
    this.throttler = this.sprout('Throttler', Throttler);
    this.handler   = this.sprout('Handler', null);
    if (this.handler.start == null) this.logger.error('Missing .start method');
    if (this.handler.stop == null)  this.logger.error('Missing .stop method');
  }

  public async start() {
    if (await this.handler.start()) {

      if (this.handler.handleCommand != null) {
        this.logger.log('Listening %s.Command', this.props.name);
        this.bus.listen(this.props.name, async (command: InCommand) => {
          this.debouncer.satisfy(command, command => {
            return this.handler.handleCommand(command);
          });
        });
      }

      if (this.handler.handleQuery != null) {
        this.logger.log('Serving %s.Query', this.props.name);
        this.bus.serve(this.props.name, async (query: InQuery) => {
          this.throttler.satisfy(query, query => {
            return this.handler.handleQuery(query);
          });
        });
      }

      return true;
    } else {
      return false;
    }
  }

  public async stop() {
    await this.handler.stop()
  }

}
