import * as Component from './Component';
import { Query, InQuery } from './Query';
import { Reply } from './Reply';
export interface Props extends Component.Props {
    ttl?: number;
}
export interface Children extends Component.Children {
}
export declare class Throttler extends Component.Component {
    private running;
    private ttl;
    constructor(props: Props, children: Children);
    satisfy(query: InQuery, handler: (query: Query) => Promise<Reply>): Promise<void>;
}
