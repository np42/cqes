import * as Component from './Component';
import { Event } from './Event';
import { State } from './State';
export interface Props extends Component.Props {
}
export interface Children extends Component.Children {
}
export declare class Factory extends Component.Component {
    constructor(props: Props, children: Children);
    apply(state: State, events: Array<Event>): any;
}
