import * as Component  from './Component';

import * as Aggregate from './Aggregate';
import * as View      from './View';
import * as Service   from './Service';
import * as Trigger   from './Trigger';
import { Testable }   from './Test';

export interface ContextProps {
  name: string;

  CommandBus:   Object;
  RpcBus:       Object;
  EventBus:     Object;
  StateBus:     Object;

  aggregates: { [name: string]: AggregateProps };
  views:      { [name: string]: ViewProps };
  services:   { [name: string]: ServiceProps };
  triggers:   { [name: string]: ServiceProps };
}

export interface AggregateProps {
  CommandBus: any;
  EventBus:   any;
  StateBus:   any;
  listen:     Array<string>;
  views:      Array<string>;
}

export interface ServiceProps {
  EventBus:     any;
  StateBus:     any;
  psubscribe:   Array<string>;
  targets:      Array<string>;
  views:        Array<string>;
  streams:      Array<string>;
  repositories: Array<string>;
}

export interface ViewProps {
  EventBus:     any;
  RpcBus:       any;
  noquery:      boolean;
  noupdate:     boolean;
  psubscribe:   Array<string>;
  views:        Array<string>;
  repositories: Array<string>;
  targets:      Array<string>;
}

export interface props extends Component.props {}

export class Context extends Component.Component {
  public aggregates: Map<string, Aggregate.Aggregate & Testable>;
  public views:      Map<string, View.View> & Testable;
  public triggers:   Map<string, Trigger.Trigger & Testable>;
  public services:   Map<string, Service.Service & Testable>;

  constructor(props: props) {
    super(props);
    this.aggregates  = new Map();
    this.views       = new Map();
    this.triggers    = new Map();
    this.services    = new Map();
  }

}
