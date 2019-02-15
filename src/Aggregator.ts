import * as Component   from './Component';
import * as Service     from './Service';

import * as Manager     from './Manager';
import * as Factory     from './Factory';
import * as Buffer      from './Buffer';
import * as Responder   from './Responder';
import * as Reactor     from './Reactor';

import { Command }      from './Command';
import { Query }        from './Query';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Props extends Component.Props {
  tryCount?:   number;
  Manager?:    Manager.Props;
  Buffer?:     Buffer.Props;
  Responder?:  Responder.Props;
  Reactor?:    Reactor.Props;
  Factory?:    Factory.Props;
}

export interface Children extends Component.Children {
  Manager:    { new(props: Manager.Props, children: Manager.Children): Manager.Manager };
  Buffer:     { new(props: Buffer.Props, children: Buffer.Children): Buffer.Buffer };
  Responder:  { new(props: Responder.Props, children: Responder.Children): Responder.Responder };
  Reactor:    { new(props: Reactor.Props, children: Reactor.Children): Reactor.Reactor };
  Factory:    { new(props: Factory.Props, children: Factory.Children): Factory.Factory };
}

export class Aggregator extends Component.Component implements Service.Handler {
  public manager:    Manager.Manager;
  public buffer:     Buffer.Buffer;
  public responder:  Responder.Responder;
  public reactor:    Reactor.Reactor;
  public factory:    Factory.Factory;

  constructor(props: Props, children: Children) {
    super({ type: 'Aggregator', color: 'green', ...props }, children);
    this.manager    = this.sprout('Manager', Manager);
    this.buffer     = this.sprout('Buffer', Buffer);
    this.responder  = this.sprout('Responder', Responder);
    this.reactor    = this.sprout('Reactor', Reactor);
    this.factory    = this.sprout('Factory', Factory);
  }

  public start(): Promise<boolean> {
    return this.buffer.start();
  }

  public stop(): Promise<void> {
    return this.buffer.stop();
  }

  public async handle(command: Command): Promise<Reply> {
    const key    = command.key;
    const state  = await this.buffer.get(key); // Locks
    const events = await this.manager.handle(state, command);
    try {
      const newState = this.factory.apply(state, events);
      if (state !== newState) await this.buffer.update(state.version, newState, events);
      this.reactor.on(newState, events);
      return this.responder.responde(command, newState, events);
    } catch (e) {
      this.logger.error('Discarding command %s: %s', command.key, String(e));
      throw e;
    } finally {
      this.buffer.drain(key); // Unlocks
    }
  }

  public resolve(query: Query): Promise<Reply> {
    return this.buffer.resolve(query);
  }

}
