import { v4 as uuidv4 } from 'uuid';
import { Logger }       from './Logger';
import * as CQES        from './CQESBus';

import { State }        from './State';
import { OutEvent }     from './Event';
import { CommandData }  from './Command';

const CachingMap = require('caching-map');

interface CachingMap<V> extends Map<string, V> {

}

type Typer      = Object;
type Reducer    = Object;
type Manager    = Object;
type Translator = Object;
type Projector  = Object;
type Automate   = Object;
type Gateway    = Object;
type Repository = Object;

interface Options {
  size?: number;
  color?: string;
}

interface Stream {
  typer: Typer
}

interface Topic {
  typer: Typer
}

export class Aggregator<Type> {

  public  Type:      Type;

  // --

  protected bus:     CQES.Bus;
  protected states:  CachingMap<Type>;
  protected logger:  Logger;

  // --

  protected streams:      Map<string, Typer>;
  protected topics:       Map<string, Typer>;

  protected reducers:     Map<string, Reducer>;
  protected projectors:   Map<string, Projector>;
  protected automates:    Map<string, Automate>;

  protected translators:  Map<string, Translator>;
  protected managers:     Map<string, Manager>;

  protected gateways:     Map<string, Gateway>;
  protected repositories: Map<string, Repository>;

  constructor(TypeClass: { new (): Type }, options?: Options) {
    if (options == null) options = <any>{};
    this.logger = new Logger(TypeClass.name, options.color || 'yellow');
    this.states = new CachingMap(options.size || 100);
    // --
    this.streams      = new Map();
    this.topics       = new Map();
    this.reducers     = new Map();
    this.projectors   = new Map();
    this.automates    = new Map();
    this.translators  = new Map();
    this.managers     = new Map();
    this.gateways     = new Map();
    this.repositories = new Map();
  }

  from(stream: string, typer: Typer, reducer?: Reducer) {
    this.streams.set(stream, typer);
    if (reducer != null) this.reducers.set(stream, reducer);
    return this;
  }

  listen(topic: string, typer: Typer, manager?: Manager, translator?: Translator) {
    this.topics.set(topic, typer);
    if (translator != null) this.translators.set(topic, translator);
    if (manager != null) this.managers.set(topic, manager);
    return this;
  }

  on(projector: Projector) {
    return this;
  }

  when(automate: Automate) {
    return this;
  }

  serve(store: string, repository: Repository) {
    return this;
  }

  // --------

  start(config: CQES.Options) {
    if (this.bus != null) throw new Error('Aggregate already connected');
    this.bus = new CQES.Bus(config);
  }

  stop() {
    if (this.bus == null) return ;
    this.bus.stop();
    this.bus = null;
  }

}

/***********************************/

export class Aggregate<Value extends Entity> {
  public  id:     string;
  public  value:  Value;
  constructor(value: Value, id?: string) {
    this.value = value;
    this.id    = id || uuidv4();
  }
}

export class Entity {

}

export class Value {

}
