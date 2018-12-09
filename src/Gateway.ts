import * as Component   from './Component';
import * as Service     from './Service';

import { Command }      from './Command';
import { Query }        from './Query';
import { Event }        from './Event';
import { State }        from './State';
import { Reply }        from './Reply';

export interface Props extends Component.Props {}

export interface Children extends Component.Children {}

export class Gateway extends Component.Component implements Service.Handler {

  constructor(props: Props, children: Children) {
    super({ type: 'Gateway', color: 'yellow', ...props }, children);
  }

  public start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

}