import * as Component   from './Component';
import * as StateAble   from './StateAble';
import { Service }      from './Service';
import { Event }        from './Event';
import { State }        from './State';
import { Typer }        from 'cqes-type';

export type handler = (event: Event) => Promise<void>;

export interface props extends Component.props {}

export class Handlers extends Component.Component {
}
