import * as Component from './Component';
import { State } from './State';
import { Command } from './Command';
import { Event } from './Event';
export interface Props extends Component.Props {
}
export interface Children extends Component.Children {
}
export declare class Manager extends Component.Component {
    constructor(props: Props, children: Children);
    empty(): Array<Event>;
    handle(state: State, command: Command): Promise<Array<Event>>;
}
