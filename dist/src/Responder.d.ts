import * as Component from './Component';
import { Command } from './Command';
import { State } from './State';
import { Event } from './Event';
import { Reply } from './Reply';
export interface Props extends Component.Props {
}
export interface Children extends Component.Children {
}
export declare class Responder extends Component.Component {
    constructor(props: Props, children: Children);
    responde(command: Command, state: State, events: Array<Event>): Reply;
}
