import { Bus } from './Bus';
import { Logger } from './Logger';
export interface Props {
    name: string;
    type: string;
    color?: string;
    bus?: Bus;
    [others: string]: any;
}
export interface Children {
}
export declare class Component {
    protected props: Props;
    protected children: Children;
    protected logger: Logger;
    protected bus: Bus;
    constructor(props: Props, children: Children);
    sprout(name: string, alternative?: any): any;
}
