import { v4 as uuidv4 } from 'uuid';
import { Logger }       from './Logger';
import * as CQES        from './CQESBus';

import { OutEvent
       , InEvent
       , EventData
       }                from './Event';
import { CommandData }  from './Command';

const CachingMap = require('caching-map');

interface CachingMap<V> extends Map<string, V> {

}

type Typer      = { [event: string]: { new(data: any): EventData } };
type Reducer    = { $init?: any, [event: string]: (state: any, event: InEvent<any>) => any };
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
  typer: Typer;
  subscription?: any;
  group?: string;
}

interface Topic {
  typer: Typer;
  subscription?: any;
}

export class Aggregator<Type extends Entity> {

  public  Type:      { new(data?: any): Type };

  // --

  protected bus:     CQES.Bus;
  protected config:  any;
  protected states:  CachingMap<Type>;
  protected logger:  Logger;

  // --

  protected streams:      Map<string, Stream>;
  protected topics:       Map<string, Topic>;

  protected reducers:     Map<string, Reducer>;
  protected projectors:   Map<string, Projector>;
  protected automates:    Map<string, Automate>;

  protected translators:  Map<string, Translator>;
  protected managers:     Map<string, Manager>;

  protected gateways:     Map<string, Gateway>;
  protected repositories: Map<string, Repository>;

  // --

  private eventsDefinitionLacks:   { [type: string]: number };
  private commandsDefinitionLacks: { [type: string]: number };

  constructor(TypeClass: { new(data?: any): Type }, options?: Options) {
    if (options == null) options = <any>{};
    this.logger = new Logger(TypeClass.name, options.color || 'yellow');
    this.Type   = TypeClass;
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
    // --
    this.eventsDefinitionLacks   = {};
    this.commandsDefinitionLacks = {};
  }

  from(stream: string, typer: Typer, reducer?: Reducer) {
    this.streams.set(stream, { typer });
    if (reducer != null) this.reducers.set(stream, reducer);
    return this;
  }

  listen(topic: string, typer: Typer, manager?: Manager, translator?: Translator) {
    this.topics.set(topic, { typer });
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

  start(bus: CQES.Options, options: any) {
    if (this.bus != null) throw new Error('Aggregate already connected');
    this.config = options;
    this.bus    = new CQES.Bus(bus);
    this.startReducer();
  }

  stop() {
    if (this.bus == null) return ;
    this.bus.stop();
    this.bus = null;
  }

  // ---------

  startReducer() {
    for (const [name, stream] of this.streams) {
      const reducer = this.reducers.get(name);
      if (reducer == null) continue ;
      this.bus.E.subscribe(name, null, async event => {
        this.logger.log( '%cyan %green [ %yellow ] %s@%s', '<<', 'Event'
                       , event.type, event.number, event.stream
                       );
        const key = event[stream.group || 'stream'];
        let state = this.states.get(key);
        if (event.number == 0 || event.type == 'Snapshot' || state != null) {
          const data = this.typeEvent(event, stream.typer);
          if (data == null) return ;
          event.data = data;
          if (state == null) {
            if (event.number == 0) state = '$init' in reducer ? reducer.$init() : {};
            else if (event.type == 'Snapshot') state = data;
          }
          if (event.type in reducer) state = reducer[event.type](state, event);
          this.states.set(key, state);
        } else {
          /* Drop the event */
        }
      });
    }
  }

  typeEvent(event: InEvent<any>, typer: Typer) {
    if (event.type in typer) {
      return new typer[event.type](event.data);
    } else if (event.type == 'Snapshot') {
      return <any>new this.Type(event.data);
    } else {
      const now = Date.now();
      if ((this.eventsDefinitionLacks[event.type] | 0) + 60000 < now) {
        this.logger.warn('[ %s ] Skiping %s because of lack of Event definition', name, event.type);
        this.eventsDefinitionLacks[event.type] = now;
      }
      return null;
    }
  }

}

/***********************************/

export class Aggregate<Data extends Entity> {
  public id:      string;
  public data:    Data;
  public version: number;
  constructor(id?: string, data?: Data, version?: number) {
    this.id      = id != null ? id : uuidv4();
    this.data    = data != null ? data : null;
    this.version = version >= 0 ? version : -1;
  }
  set(version: number, data: Data) {
    if (data == null) throw new Error('Data cannot be null');
    if (!(version >= 0)) throw new Error('Bad version number');
    this.data    = data;
    this.version = version;
  }
}

export class Entity {
  constructor(data?: any) {
  }
}

export class Value {
  constructor(data?: any) {
  }
}
