import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { State }        from './State';
import { Bus }          from './Bus';

import * as Manager     from './Manager';
import * as Buffer      from './Buffer';
import * as Repository  from './Repository';
import * as Responder   from './Responder';
import * as Factory     from './Factory';
import * as Reactor     from './Reactor';

export interface Config {
  name:        string;
  Manager?:    Manager.Config;
  Factory?:    Factory.Config;
  Buffer?:     Buffer.Config;
  Repository?: Repository.Config;
  Responder?:  Responder.Config;
  Reactor?:    Reactor.Config;
};

export class Aggregator implements Service.Handler {
  private logger:     Logger;
  private config:     Config;
  private manager:    Manager.Manager;
  private buffer:     Buffer.Buffer;
  private repository: Repository.Repository;
  private factory:    Factory.Factory;
  private responder:  Responder.Responder;
  private reactor:    Reactor.Reactor;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Aggregator', 'grey');
    this.config = config;
  }

  public init(_: never, bus: Bus) {
    this.config.Manager.bus = bus;
    this.manager    = new Manager.Manager(this.config.Manager);
    this.repository = new Repository.Repository(this.config.Repository);
    this.config.Buffer.repository = this.repository;
    this.buffer     = new Buffer.Buffer(this.config.Buffer);
    this.factory    = new Factory.Factory(this.config.Factory);
    this.responder  = new Responder.Responder(this.config.Responder);
    this.config.Reactor.bus = bus;
    this.reactor    = new Reactor.Reactor(this.config.Reactor);
  }

  public start(): Promise<boolean> {
    return this.repository.start();
  }

  public stop(): Promise<void> {
    return this.repository.stop();
  }

  public async handleCommand(command: Command): Promise<Reply> {
    const key = command.key;
    let tryCount = 10;
    while (--tryCount >= 0) {
      /*/ console.log('Command Handled', tryCount, command); /**/
      const state  = await this.buffer.get(key);
      const events = await this.manager.handle(state, command);
      try {
        const newState = this.buffer.update(key, state.version, state => {
          return this.factory.apply(state, events);
        });
        /*/ console.log('State updated', newState.version); /**/
        this.reactor.produce(newState, events);
        return this.responder.resolve(command, newState, events);
      } catch (e) {
        if (tryCount >= 0) continue ;
        this.logger.warn('Discarding command %s:', e);
        throw e;
      }
    }
  }

  public handleQuery(query: Query): Promise<Reply> {
    return this.repository.resolve(query);
  }

}
