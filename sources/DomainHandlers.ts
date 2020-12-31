import * as Component   from './Component';
import { State as S }   from './State';
import { Event as E }   from './Event';

export type handler = (state: S, event: E) => S;

export interface props extends Component.props {}

export class Handlers extends Component.Component {}
