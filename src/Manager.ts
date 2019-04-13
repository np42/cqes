import * as Service        from './Service';

import * as CH             from './CommandHandler';
import * as Factory        from './Factory';
import * as Buffer         from './Buffer';
import * as Repository     from './Repository';
import * as Reactor        from './Reactor';

import { command }         from './command';
import { query }           from './query';
import { reply }           from './reply';
import { event }           from './event';
import { state }           from './state';

export interface props extends Service.props {
  CommandHandler?: CH.props;
  Factory?:        Factory.props;
  Buffer?:         Buffer.props;
  Repository?:     Repository.props;
  Reactor?:        Reactor.props;
}

export interface children extends Service.children {
  CommandHandler: { new(props: CH.props,         children: CH.children):         CH.CommandHandler };
  Factory:        { new(props: Factory.props,    children: Factory.children):    Factory.Factory };
  Buffer:         { new(props: Buffer.props,     children: Buffer.children):     Buffer.Buffer };
  Repository:     { new(props: Repository.props, children: Repository.children): Repository.Repository };
  Reactor:        { new(props: Reactor.props,    children: Reactor.children):    Reactor.Reactor };
}

export class Manager extends Service.Service {
  protected started:     boolean;
  protected pending:     Map<string, Array<command<any>>>
  public commandHandler: CH.CommandHandler;
  public factory:        Factory.Factory;
  public buffer:         Buffer.Buffer;
  public repository:     Repository.Repository;
  public reactor:        Reactor.Reactor;

  constructor(props: props, children: children) {
    super({ ...props, type: 'manager', color: 'cyan' }, children);
    this.started        = false;
    this.pending        = new Map();
    this.commandHandler = this.sprout('CommandHandler', CH, { bus: this.bus });
    this.factory        = this.sprout('Factory',        Factory);
    this.buffer         = this.sprout('Buffer',         Buffer);
    this.repository     = this.sprout('Repository',     Repository, { bus: this.bus });
    this.reactor        = this.sprout('Reactor',        Reactor, { bus: this.bus });
  }

  // Query
  public async resolve(query: query<any>): Promise<reply<any>> {
    return this.repository.resolve(query);
  }

  // Command
  public async handle(command: command<any>) {
    const id = command.id;
    if (this.started === false || this.pending.has(id)) return this.queue(command);
    this.pending.set(id, []);
    await this.update(command);
    this.drain(id);
  }

  protected async update(command: command<any>) {
    const id = command.id;
    try {
      if (!this.buffer.has(id)) await this.load(id);
      const state = this.buffer.get(id);
      const events = await this.commandHandler.handle(state, command);
      if (events != null && events.length > 0) {
        const newState = this.factory.apply(state, events);
        await this.buffer.update(newState);
        this.react(newState);
      }
      this.bus.command.discard(command);
    } catch (e) {
      this.logger.error(e);
      this.bus.command.relocate(command, '.failure');
    }
  }

  protected queue(command: command<any>) {
    const queue = this.pending.get(command.id);
    if (queue == null) {
      this.pending.set(command.id, [command]);
    } else {
      if (queue.length > 0) this.logger.warn('Slow queue:', command.key);
      queue.push(command);
    }
  }

  protected load(id: string) {
    return new Promise((resolve, reject) => {
      this.repository.load(id).then(state => {
        if (state == null) {
          this.logger.error();
          reject('Unable to load State for: ' + id);
        } else {
          this.buffer.setnx(id, state);
          resolve();
        }
      }).catch(reject);
    });
  }

  protected async react(state: state<any>) {
    this.repository.save(state);
    this.reactor.on(state);
  }

  public async drain(id: string) {
    const pending = this.pending.get(id);
    if (pending == null) return ;
    if (pending.length > 0) {
      const command = pending.shift();
      await this.update(command);
      this.drain(id);
    } else {
      this.pending.delete(id);
    }
  }

  //--
  public async start() {
    const started = await this.repository.start();
    if (started) {
      this.started = true;
      for (const [id] of this.pending)
        this.drain(id);
    }
    return started;
  }

  public stop() {
    this.started = false;
    return this.repository.stop();
  }

}
