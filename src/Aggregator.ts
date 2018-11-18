import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query }        from './Query';
import { Reply }        from './Reply';
import { State }        from './State';

import * as Filter      from './Filter';
import * as Manager     from './Manager';
import * as Buffer      from './Buffer';
import * as Repository  from './Repository';
import * as Responder   from './Responder';
import * as Factory     from './Factory';
import * as Reactor     from './Reactor';

export interface Config {
  name:        string;
  Filter?:     Filter.Config;
  Manager?:    Manager.Config;
  Factory?:    Factory.Config;
  Buffer?:     Buffer.Config;
  Repository?: Repository.Config;
  Responder?:  Responder.Config;
  Reactor?:    Reactor.Config;
};

export class Aggregator implements Service.Handler {
  private logger:     Logger;
  private filter:     Filter.Filter;
  private manager:    Manager.Manager;
  private buffer:     Buffer.Buffer;
  private repository: Repository.Repository;
  private factory:    Factory.Factory;
  private responder:  Responder.Responder;
  private reactor:    Reactor.Reactor;

  constructor(config: Config) {
    this.logger     = new Logger(config.name + '.Aggregator', 'grey');
    this.filter     = new Filter.Filter(config.Filter);
    this.manager    = new Manager.Manager(config.Manager);
    this.repository = new Repository.Repository(config.Repository);
    config.Buffer.repository = this.repository;
    this.buffer     = new Buffer.Buffer(config.Buffer);
    this.factory    = new Factory.Factory(config.Factory);
    this.responder  = new Responder.Responder(config.Responder);
    this.reactor    = new Reactor.Reactor(config.Reactor);
  }

  public start(): Promise<boolean> {
    return this.repository.start();
  }

  public stop(): Promise<void> {
    return this.repository.stop();
  }

  public async handleCommand(command: Command): Promise<Service.Result> {
    await this.filter.assert(command);
    const key = command.key;
    let tryCount = 10;
    while (--tryCount >= 0) {
      const state  = await this.buffer.get(key);
      const events = await this.manager.handle(state, command);
      try {
        const newState = this.buffer.update(key, state.version, state => {
          return this.factory.apply(state, events);
        });
        const reply   = this.responder.produce(command, newState, events);
        const commands = this.reactor.produce(newState, events);
        return { reply, commands };
      } catch (e) {
        if (tryCount >= 0) continue ;
        this.logger.warn('Discarding command %s:', e);
        throw new Error(e);
      }
    }
  }

  public async handleQuery(query: Query): Promise<Reply> {
    return null;
  }

}
