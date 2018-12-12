import * as Component from './Component';
import { Command, InCommand } from './Command';
import { Reply } from './Reply';
export interface Props extends Component.Props {
    size?: number;
    ttl?: number;
}
export interface Children extends Component.Children {
}
export declare class Debouncer extends Component.Component {
    private waiting;
    private ttl;
    constructor(props: Props, children: any);
    satisfy(command: InCommand, handler: (command: Command) => Promise<Reply>): Promise<void>;
}
