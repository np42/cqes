import * as Component  from './Component';

import * as Manager    from './Manager';
import * as View       from './View';
import * as Service    from './Service';
import * as Projection from './Projection';

export interface ContextProps {
  name:         string;

  CommandBus:   Object;
  QueryBus:     Object;
  EventBus:     Object;
  StateBus:     Object;

  managers:     { [name: string]: Manager.props };
  views:        { [name: string]: View.props };
  projections:  { [name: string]: Projection.props };
  services:     { [name: string]: Service.props };
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
