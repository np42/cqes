import * as Element from './Element';
import { Bus }      from './Bus';

export interface props extends Element.props {
  bus?: Bus;
}

export class Component extends Element.Element {
  protected bus: Bus;
}
