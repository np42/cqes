import { Logger }       from './Logger';
import * as CQES        from './CQESBus';

import { Entity } from './Aggregate';
import { OutEvent
       , InEvent
       , EventData
       }                from './Event';
import { CommandData }  from './Command';
import { InQuery }      from './Query';

const CachingMap = require('caching-map');

export interface CachingMap<V> extends Map<string, V> {

}

type Typer      = { [event: string]: { new(data: any): EventData } };
type Reducer    = { $init?: any, [event: string]: (state: any, event: InEvent<any>) => any };
type Manager    = Object;
type Translator = Object;
type Projector  = Object;
type Automate   = Object;

export interface Options {
  size?: number;
  color?: string;
}

export interface Stream {
  typer: Typer;
  subscription?: any;
  group?: string;
}

export interface Topic {
  typer: Typer;
  subscription?: any;
}

export interface Request {
  typer: Typer;
  subscription?: any;
}


export class Aggregator<Type extends Entity> {

  public  Type: { new(data?: any): Type };

  // --

  protected bus:     CQES.Bus;
  protected config:  any;
  protected states:  CachingMap<{ state: Type, event: InEvent<any> }>;
  protected logger:  Logger;

  // --

  protected streams:      Map<string, Stream>;
  protected topics:       Map<string, Topic>;
  protected requests:     Map<string, Request>;

  protected reducers:     Map<string, Reducer>;
  protected projectors:   Map<string, Projector>;
  protected automates:    Map<string, Automate>;

  protected translators:  Map<string, Translator>;
  protected managers:     Map<string, Manager>;

  // --

  private eventsDefinitionLacks:   { [type: string]: number };
  private commandsDefinitionLacks: { [type: string]: number };

  constructor(TypeClass: { new(data?: any): Type }, options?: Options) {
    if (options == null) options = <any>{};
    this.logger = new Logger(TypeClass.name, options.color || 'yellow');
    this.Type   = TypeClass;
    this.states = new CachingMap(options.size || 100);
    // --
    this.clear();
  }

  protected clear() {
    this.streams      = new Map();
    this.topics       = new Map();
    this.requests     = new Map();
    this.reducers     = new Map();
    this.projectors   = new Map();
    this.automates    = new Map();
    this.translators  = new Map();
    this.managers     = new Map();
    // --
    this.eventsDefinitionLacks   = {};
    this.commandsDefinitionLacks = {};
  }

  public from(stream: string, typer: Typer, reducer?: Reducer) {
    this.streams.set(stream, { typer });
    if (reducer != null) this.reducers.set(stream, reducer);
    return this;
  }

  public listen(topic: string, typer: Typer, manager?: Manager, translator?: Translator) {
    this.topics.set(topic, { typer });
    if (translator != null) this.translators.set(topic, translator);
    if (manager != null) this.managers.set(topic, manager);
    return this;
  }

  public on(projector: Projector) {
    return this;
  }

  public when(automate: Automate) {
    return this;
  }

  /*
  public serve(store: string, repository: Repository) {
    return this;
  }
  */

  // --------

  public start(bus: CQES.Options, options: any) {
    if (this.bus != null) throw new Error('Aggregate already connected');
    this.init(options);
    this.bus = new CQES.Bus(bus);
    this.startStateHandler();
    this.startQueryHandler();
    this.startEventHandler();
    this.startCommandHandler();
  }

  protected init(options: any) {
    this.config = options;
  }

  public stop() {
    if (this.bus == null) return ;
    this.bus.stop();
    this.bus = null;
  }

  // ---------

  protected startStateHandler() {
    for (const [name, stream] of this.streams) {
      const reducer = this.reducers.get(name);
      if (reducer == null) continue ;
      this.bus.E.subscribe(name, null, async event => {
        const key = event[stream.group || 'stream'];
        if (key != null) {
          let { state } = this.states.get(key) || { state: null };
          if (event.number == 0 || event.type == 'Snapshot' || state != null) {
            event.data = this.typeEvent(event, stream.typer);
            if (state == null) {
              if (event.number == 0) state = '$init' in reducer ? reducer.$init() : {};
              else if (event.type == 'Snapshot') state = event.data;
            }
            if (event.type in reducer) state = reducer[event.type](state, event);
            this.states.set(key, { state, event });
          } else {
            return ;
          }
        } else {
          event.data = this.typeEvent(event, stream.typer);
        }
        this.logger.log( '%cyan %green [ %yellow ] %s@%s', '<<', 'Event'
                       , event.type, event.number, event.stream
                       );
      });
    }
  }

  protected typeEvent(event: InEvent<any>, typer: Typer) {
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

  protected startQueryHandler() {
    for (const [name, request] of this.requests) {
      this.bus.Q.serve(name, async (query: InQuery<any>) => {

      });
    }
  }

  protected startEventHandler() {

  }

  protected startCommandHandler() {

  }

}

/***********************************/
