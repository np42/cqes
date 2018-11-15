import * as Service     from './Service';

import { Logger }       from './Logger';

import { Command }      from './Command';
import { Query, Reply } from './Query';
import { Event }        from './Event';
import { State }        from './State';

import * as Filter      from './Filter';
import * as Manager     from './Manager';
import * as Repository  from './Repository';
import * as Factory     from './Factory';
import * as Reactor     from './Reactor';

export interface Config {
  name:        string;
  Filter?:     Filter.Config;
  Manager?:    Manager.Config;
  Factory?:    Factory.Config;
  Repository?: Repository.Config;
  Reactor?:    Reactor.Config;
};

export class Aggregator implements Service.Handler {
  private logger:     Logger;
  private filter:     Filter.Filter;
  private manager:    Manager.Manager;
  private repository: Repository.Repository;
  private factory:    Factory.Factory;
  private reactor:    Reactor.Reactor;

  constructor(config: Config) {
    this.logger     = new Logger(config.name + '.Aggregator', 'grey');
    this.filter     = new Filter.Filter(config.Filter);
    this.manager    = new Manager.Manager(config.Manager);
    this.repository = new Repository.Repository(config.Repository);
    this.factory    = new Factory.Factory(config.Factory);
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
      const state  = await this.repository.get(key);
      const events = await this.manager.handle(state, command);
      if (events.length == 0) return { events: [], commands: [] };
      try {
        const newState = this.repository.update(key, state.version, (state, events) => {
          return this.factory.apply(state, events);
        }, events);
        const commands: Array<Command> = [];
        for (let i = 0; i < events.length; i += 1) {
          const result = this.reactor.handle(newState, events[i]);
          Array.prototype.push.apply(commands, result);
        }
        return { events, commands };
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
