import * as Service         from './Service';

import { State }            from './State';
import { Command }          from './Command';
import { Event }            from './Event';
import { Query }            from './Query';

import * as Facet           from './Facet';

import { Filter }           from './Filter';
import { Manager }          from './Manager';
import { Repository, Link } from './Repository';
import { Factory }          from './Factory';
import { Reactor }          from './Reactor';

export type Result = { events: Array<Event>, commands: Array<Command> };

export type Config = { name: string };

export interface Facets {
  Manager?:    Facet.Manager;
  Factory?:    Facet.Factory;
  Repository?: Facet.Respository;
  Reactor?:    Facet.Reactor;
}

export class Aggregator extends Service.Handler {
  private filter:     Filter;
  private manager:    Manager;
  private repository: Repository;
  private factory:    Factory;
  private reactor:    Reactor;

  constructor(config: Config, facets: Facets, link: Link) {
    super(config);
    this.filter     = new Filter(config,     facets.Filter);
    this.manager    = new Manager(config,    facets.Manager);
    this.repository = new Repository(config, facets.Repository, link);
    this.factory    = new Factory(config,    facets.Factory);
    this.reactor    = new Reactor(config,    facets.Reactor);
  }

  public async handleCommand(command: Command): Promise<Result> {
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
        const commands = [];
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
