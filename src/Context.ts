import * as Component  from './Component';

import * as Manager from './Manager';
import * as View    from './View';
import * as Service from './Service';
import * as Trigger from './Trigger';

export interface ContextProps {
  name: string;

  CommandBus:   Object;
  QueryBus:     Object;
  EventBus:     Object;
  StateBus:     Object;

  managers: { [name: string]: ManagerProps };
  views:    { [name: string]: ViewProps };
  services: { [name: string]: ServiceProps };
  triggers: { [name: string]: ServiceProps };
}

export interface ManagerProps {
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

export interface ViewProps extends ServiceProps {
  QueryBus:     any;
  psubscribe:   Array<string>;
  views:        Array<string>;
  repositories: Array<string>;
}

export interface props extends Component.props {}

export class Context extends Component.Component {
  public managers: Map<string, Manager.Manager>;
  public views:    Map<string, View.View>;
  public triggers: Map<string, Trigger.Trigger>;
  public services: Map<string, Service.Service>;

  constructor(props: props) {
    super(props);
    this.managers  = new Map();
    this.views     = new Map();
    this.triggers  = new Map();
    this.services  = new Map();
  }

}
