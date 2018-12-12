import * as Component from './Component';
import * as Service from './Service';
export interface Props extends Component.Props {
}
export interface Children extends Component.Children {
}
export declare class Gateway extends Component.Component implements Service.Handler {
    constructor(props: Props, children: Children);
    start(): Promise<boolean>;
    stop(): Promise<void>;
}
