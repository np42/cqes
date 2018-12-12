import * as Component from './Component';
import * as Debouncer from './Debouncer';
import * as Throttler from './Throttler';
import * as Gateway from './Gateway';
import * as Aggregator from './Aggregator';
import { Command } from './Command';
import { Query } from './Query';
import { Reply } from './Reply';
export interface Props extends Component.Props {
    Debouncer?: Debouncer.Props;
    Throttler?: Throttler.Props;
    Gateway?: Gateway.Props;
    Aggregator?: Aggregator.Props;
}
export interface Children extends Component.Children {
    Throttler: {
        new (props: Throttler.Props, children: Throttler.Children): Throttler.Throttler;
    };
    Debouncer: {
        new (props: Debouncer.Props, children: Debouncer.Children): Debouncer.Debouncer;
    };
    Gateway?: {
        new (props: Gateway.Props, children: Gateway.Children): Handler;
    };
    Aggregator?: {
        new (props: Aggregator.Props, children: Aggregator.Children): Handler;
    };
}
export interface Handler {
    start: () => Promise<boolean>;
    stop: () => Promise<void>;
    handle?: (command: Command) => Promise<Reply>;
    resolve?: (query: Query) => Promise<Reply>;
}
export declare class Service extends Component.Component {
    debouncer: Debouncer.Debouncer;
    throttler: Throttler.Throttler;
    handler: Handler;
    constructor(props: Props, children: Children);
    start(): Promise<boolean>;
    stop(): Promise<void>;
}
