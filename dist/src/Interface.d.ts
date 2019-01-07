import { Bus } from './Bus';
import { Logger } from './Logger';
import * as Component from './Component';
export interface Props extends Component.Props {
}
export declare class Interface {
    protected props: Props;
    protected bus: Bus;
    protected logger: Logger;
    constructor(props: Props);
}
