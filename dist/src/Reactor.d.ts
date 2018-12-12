import * as Component from './Component';
import { State } from './State';
import { Event } from './Event';
export interface Props extends Component.Props {
}
export interface Children extends Component.Children {
}
export declare class Reactor extends Component.Component {
    constructor(props: Props, children: Children);
    on(state: State, events: Array<Event>): void;
}
