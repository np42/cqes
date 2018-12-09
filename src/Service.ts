import * as Component                     from './Component';

import * as Bus                           from './Bus';
import * as Debouncer                     from './Debouncer';
import * as Throttler                     from './Throttler';
import * as Gateway                       from './Gateway';
import * as Aggregator                    from './Aggregator';

import { Command, InCommand, OutCommand } from './Command';
import { Query, InQuery }                 from './Query';
import { Reply }                          from './Reply';

export interface Props extends Component.Props {
  Debouncer?:  Debouncer.Props;
  Throttler?:  Throttler.Props;
  Gateway?:    Gateway.Props;
  Aggregator?: Aggregator.Props;
}

export interface Children extends Component.Children {
  Throttler:   { new(props: Throttler.Props, children: Throttler.Children): Throttler.Throttler };
  Debouncer:   { new(props: Debouncer.Props, children: Debouncer.Children): Debouncer.Debouncer };
  Gateway?:    { new(props: Gateway.Props, children: Gateway.Children): Handler };
  Aggregator?: { new(props: Aggregator.Props, children: Aggregator.Children): Handler };
}

export interface Handler {
  start:    () => Promise<boolean>;
  stop:     () => Promise<void>;
  handle?:  (command: Command) => Promise<Reply>;
  resolve?: (query: Query) => Promise<Reply>;
}

export class Service extends Component.Component {
  public debouncer: Debouncer.Debouncer;
  public throttler: Throttler.Throttler;
  public handler:   Handler;

  constructor(props: Props, children: Children) {
    super(props, children);
    this.bus       = this.sprout('Bus', Bus);
    this.debouncer = this.sprout('Debouncer', Debouncer);
    this.throttler = this.sprout('Throttler', Throttler);
    switch (props.type) {
    case 'Gateway': { this.handler = this.sprout('Gateway', Gateway); }; break ;
    case 'Aggregator': { this.handler = this.sprout('Aggregator', Aggregator); }; break ;
    }
    if (this.handler.start == null) this.logger.error('Missing .start method');
    if (this.handler.stop == null)  this.logger.error('Missing .stop method');
  }

  public async start() {
    if (await this.handler.start()) {

      if (this.handler.handle != null) {
        this.logger.log('Listening %s.Command', this.props.name);
        this.bus.listen(this.props.name, async (command: InCommand) => {
          this.debouncer.satisfy(command, command => {
            return this.handler.handle(command);
          });
        });
      }

      if (this.handler.resolve != null) {
        this.logger.log('Serving %s.Query', this.props.name);
        this.bus.serve(this.props.name, async (query: InQuery) => {
          this.throttler.satisfy(query, query => {
            return this.handler.resolve(query);
          });
        });
      }

      return this.bus.start();
    } else {
      return false;
    }
  }

  public async stop() {
    await this.handler.stop();
    await this.bus.stop();
  }

}
