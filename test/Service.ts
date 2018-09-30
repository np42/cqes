import Logger                                 from './Logger';
import { Fx }                                 from './Fx';
import { CQESBus }                            from './CQESBus';
import { InCommand, OutCommand, CommandData } from './Command';
import { OutEvent }                           from './Event';
import { InQuery, OutQuery }                  from './Query';
import { State, StateData }                   from './State';

// Remove this interface
export interface IService {
  new (config: any): Service;
  name: string;
}

export interface Service {
  new (config: any): Service;
  name: string;
}

export type Automate = (state: State<any>, command: InCommand<any>) => Promise<AutomateResponse>;
export type AutomateResponse = Array<OutCommand<any>>;

export type TypesSet  = { [key: string]: any };
export type Applicant = { [key: string]: any };

export class Service {

  public    name:       string;
  private   _name:      { toString: () => string, toJSON: () => any };
  protected color:      string;
  private   _color:     { toString: () => string }
  protected config:     any;
  protected logger:     Logger;

  protected bus:        CQESBus;
  protected stream:     Fx<any, any>;

  constructor(config: any) {
    this.config     = config;
    this.name       = 'Service';
    this._name      = { toString: () => this.name, toJSON: () => this.name };
    this.color      = 'yellow';
    this._color     = { toString: () => this.color };
    this.logger     = new Logger(this._name, <any>this._color);
    this.bus        = config.Bus ? new CQESBus(config.Bus) : null;
    this.stream     = null;
  }

  protected async dispatch(state: State<any>, command: InCommand<any>) {
    this.logger.log('%cyan %red [ %yellow ] %s', '<<', 'Command', command.name, command.topic);
    const enricher = '$' + command.name;
    if (!(command.name in this)) {
      this.logger.warn('Command dropped:', command);
      return await command.ack();
    }
    if (enricher in this) command = await this[enricher](command);
    const arity = this[command.name].length;
    if (arity == 1) { // Command Router
      const commands = <Array<OutCommand<any>>>[];
      try {
        Array.prototype.push.apply(commands, await this[command.name](command));
      } catch (err) {
        setTimeout(() => command.cancel(), 10000); // Delay cancel to avoid retry loop of death
        this.logger.error(err);
        return ;
      }
      await this.request(commands);
      await command.ack();
    } else if (arity == 2) { // Command Handler
      let events = <Array<OutEvent<any>>>[];
      try {
        events = await this[command.name](state, command);
        if (!(events instanceof Array)) {
          events = [];
          this.logger.error("%s.%s returns bad value", this.name || '(anonymous)', command.name);
        }
      } catch (err) {
        setTimeout(() => command.cancel(), 10000); // Delay cancel to avoid retry loop of death
        this.logger.error(err);
        return ;
      }
      events.forEach(event => Object.assign(event.meta, { source: this._name }));
      if (events.length > 0) await this.publish(events);
      await command.ack();
    }
  }

  public stop() {
    this.bus.stop();
  }

  //--

  // request
  protected async request(commands: Array<OutCommand<any>>) {
    for (const command of commands) {
      this.logger.log('%magenta %red [ %yellow ] %s', '>>', 'Command', command.name, command.topic);
      this.bus.C.command(command);
    }
  }

  // listen
  protected async listen<S extends StateData, C extends CommandData>(
    topic: string, state: State<S>, types: TypesSet, applicant: Applicant = this
  ) {
    if (applicant == null || applicant.dispatch == null) debugger;
    if (state == null) state = new State(<any>StateData);
    if (this.stream == null) this.stream = Fx.create(null, { name: 'Empty' }).open();
    return this.stream.merge(async (_, fx) => {
      this.logger.log('Start listening %s', topic);
      const subscription = this.bus.C.listen(topic, async command => {
        if (command.name in types) command.data = new types[command.name](command.data);
        applicant.dispatch(state, command)
      });
      subscription.on('aborted', () => { this.logger.log('Stop listening %s', topic); });
      return subscription;
    }, { name: 'Service.Listen.' + topic });
  }

  // publish
  protected async publish(events: Array<OutEvent<any>>) {
    const perStream = new Map();
    for (const event of events) {
      if (!perStream.has(event.stream)) perStream.set(event.stream, [event]);
      else perStream.get(event.stream).push(event);
    }
    for (const [stream, events] of perStream) {
      const types = events.map((e: any) => e.type).join(' ');
      this.logger.log('%magenta %green [ %yellow ] %s', '>>', 'Event', types, stream);
      await this.bus.E.publish(stream, -2, events);
    }
  }

  // rehydrate
  protected rehydrate<D extends StateData>(
    stream: string, StateDataClass: new (_: any) => D, process?: string
  ) {
    if (this.stream != null) throw new Error('Hydrated stream already bound');
    const fxName = (action: string) => 'Service.Rehydrate.' + stream + '.' + action;
    return this.stream = new Fx(async (_, fx) => {
      this.logger.log('Retrieving state %s for rehydratation', process || StateDataClass.name);
      const restoredState = await this.bus.S.restore(StateDataClass);
      if (restoredState != null) return restoredState;
      return new State(StateDataClass, -1);
    }, { name: fxName('Snapshot'), nocache: true }).merge((state: State<D>) => {
      this.logger.log('Start rehydrating %s from %s', stream, state.position);
      return new Promise(resolve => {
        const fx = this.bus.E.subscribe(stream, state.position, async event => {
          if (event.type == '$liveReached') resolve(fx);
          state.data.apply(event);
        });
      });
    }, { name: fxName('Consume') }).open();
  }

  // subscribe
  protected subscribe<D extends StateData>(stream: string, state: State<D>) {
    this.logger.log('Start subscription %s', stream);
    return this.bus.E.subscribe(stream, null, async event => {
      this.logger.log( '%cyan %green [ %yellow ] %s@%s', '<<', 'Event'
                     , event.type, event.number, event.stream
                     );
      state.data.apply(event);
    });
  }

  // last
  protected last(stream: string, count: number) {
    return this.bus.E.last(stream, count);
  }

  // watch
  protected watch<D extends StateData>( pstream: string, StateDataClass: new (_: any) => D
                                      , automates: AutomateCollection) {
    this.logger.log('Start watching %s', pstream);
    return this.bus.E.consume(pstream, async command => {
      this.logger.log('%cyan %green %s:%s', '<<', 'Command', command.topic, command.name);
      const events   = await this.last(command.topic, 1000);
      while (events.length > 0 && events[events.length - 1].number > (<any>command).number)
        events.pop();
      const id       = command.topic.substr(command.topic.indexOf('-') + 1);
      const state    = new State(StateDataClass, id);
      state.data.apply(events);
      const rules    = automates.get(command.name);
      const commands = <Array<OutCommand<any>>>[];
      try {
        for (const automate of rules) {
          const commandsSet = await automate(state, command);
          Array.prototype.push.apply(commands, commandsSet);
        }
        if (commands.length > 0) await this.request(commands);
        command.ack();
      } catch (e) {
        this.logger.error('%green Rejected:', 'Command', e);
        command.cancel();
      }
    });
  }

  // query
  protected async query(view: string, method: string, data: any): Promise<any> {
    this.logger.log('%magenta %blue [ %yellow ] %s %j', '>>', 'Query', method, view, data);
    const query = new OutQuery(view, method, data);
    const reply = await this.bus.Q.query(query, 10);
    this.logger.debug('%cyan %blue [ %yellow ] %s %j', '<<',  'Reply', method, view, reply.data);
    if (reply.error) throw new Error(reply.error);
    return reply.data;
  }

  // serve
  protected serve<D extends StateData>(view: string, state: State<D>, handlers: any) {
    if (this.stream == null) this.stream = Fx.create(null).open();
    return this.stream.merge(async (_, fx) => {
      this.logger.log('Start serving %s', view);
      return this.bus.Q.serve(view, async (query: InQuery<any>) => {
        this.logger.log('%cyan %blue [ %yellow ] %s %j', '<<', 'Query', query.method, view, query.data);
        if (query.method in handlers) {
          const result = await handlers[query.method](state, query.data);
          this.logger.debug('%magenta %blue [ %yellow ] %s %j', '>>', 'Reply', query.method, view, result);
          return query.resolve(result);
        } else {
          return query.reject('Unknow how to deal with ' + query.method);
        }
      });
    }, { name: 'Service.Serve.' + view });
  }

}

export class AutomateCollection {
  private automates: Map<string, Array<Automate>>;

  constructor() {
    this.automates = new Map();
  }

  onAll(automate: Automate) {
    this.on('$all', automate);
  }

  on(names: string | Array<string>, automate: Automate) {
    if (typeof names == 'string') names = [names];
    for (const name of names) {
      if (!this.automates.has(name)) this.automates.set(name, []);
      this.automates.get(name).push(automate);
    }
  }

  get(name: string) {
    const all = this.automates.get('$all') || [];
    const named = this.automates.get(name) || [];
    return named.concat(all);
  }

}
