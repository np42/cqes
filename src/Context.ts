import * as Component  from './Component';

import * as Manager    from './Manager';
import * as View       from './View';
import * as Service    from './Service';
import * as Projection from './Projection';

export interface ContextProps {
  name: string;

  CommandBus:   Object;
  QueryBus:     Object;
  EventBus:     Object;
  StateBus:     Object;

  managers:     { [name: string]: ManagerProps };
  views:        { [name: string]: ViewProps };
  services:     { [name: string]: ServiceProps };
  projections:  { [name: string]: ServiceProps };
}

export interface ManagerProps {
  CommandBus: any;
  EventBus:   any;
  StateBus:   any;
  listen: Array<string>;
  views:  Array<string>;
}

export interface ServiceProps {
  psubscribe: Array<string>;
  targets:    Array<string>;
  views:      Array<string>;
}

export interface ViewProps extends ServiceProps {
  QueryBus: any;
}

export interface props extends Component.props {}

export class Context extends Component.Component {
  public managers:     Map<string, Manager.Manager>;
  public views:        Map<string, View.View>;
  public projections:  Map<string, Projection.Projection>;
  public services:     Map<string, Service.Service>;

  constructor(props: props) {
    super({ logger: 'Context:' + props.name, ...props });
    this.managers     = new Map();
    this.views        = new Map();
    this.projections  = new Map();
    this.services     = new Map();
  }

}
