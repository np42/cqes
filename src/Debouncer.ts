import * as Component         from './Component';

import { command } from './command';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface props extends Component.props {
  size?:    number;
  ttl?:     number;
}

export interface children extends Component.children {}

export class Debouncer extends Component.Component {
  private accepted: CachingMap<string, any>;
  private ttl:      number;

  constructor(props: props, children: children) {
    super({ type: 'Debouncer', color: 'white', ...props }, children);
    this.accepted = new CachingMap(props.size >= 0 ? props.size : null);
    this.ttl      = props.ttl >= 0 ? props.ttl : null;
  }

  public exists(command: command<any>): Promise<boolean> {
    return Promise.resolve(false);
  }

}
