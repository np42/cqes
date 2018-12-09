import * as Component   from './Component';
import * as Service     from './Service';

import * as Manager     from './Manager';
import * as Buffer      from './Buffer';
import * as Factory     from './Factory';
import * as Repository  from './Repository';
import * as Responder   from './Responder';
import * as Reactor     from './Reactor';

import { Command }      from './Command';
import { Query }        from './Query';
import { Event }        from './Event';
import { Reply }        from './Reply';
import { State }        from './State';

export interface Props extends Component.Props {
  Manager?:    Manager.Props;
  Factory?:    Factory.Props;
  Buffer?:     Buffer.Props;
  Repository?: Repository.Props;
  Responder?:  Responder.Props;
  Reactor?:    Reactor.Props;
}

export interface Children extends Component.Children {
  Manager:    { new(props: Manager.Props, children: Manager.Children): Manager.Manager };
  Buffer:     { new(props: Buffer.Props, children: Buffer.Children): Buffer.Buffer };
  Responder:  { new(props: Responder.Props, children: Responder.Children): Responder.Responder };
  Reactor:    { new(props: Reactor.Props, children: Reactor.Children): Reactor.Reactor };
}

export class Aggregator extends Component.Component implements Service.Handler {
  public manager:    Manager.Manager;
  public buffer:     Buffer.Buffer;
  public responder:  Responder.Responder;
  public reactor:    Reactor.Reactor;

  constructor(props: Props, children: Children) {
    super({ type: 'Aggregator', color: 'grey', ...props }, children);
    this.manager    = this.sprout('Manager', Manager);
    this.buffer     = this.sprout('Buffer', Buffer);
    this.responder  = this.sprout('Responder', Responder);
    this.reactor    = this.sprout('Reactor', Reactor);
  }

  public start(): Promise<boolean> {
    return this.buffer.start();
  }

  public stop(): Promise<void> {
    return this.buffer.stop();
  }

  public async handle(command: Command): Promise<Reply> {
    const key = command.key;
    let tryCount = 10;
    while (--tryCount >= 0) {
      this.logger.log('Handle Command [%s] %s : %s', tryCount, command.key, command.order);
      const state  = await this.buffer.get(key);
      const events = await this.manager.handle(state, command);
      try {
        const newState = this.buffer.update(key, state.version, events);
        this.reactor.on(newState, events);
        return this.responder.responde(command, newState, events);
      } catch (e) {
        if (tryCount > 0) continue ;
        this.logger.warn('Discarding command %s: %s', command.key, String(e));
        throw e;
      }
    }
  }

  public resolve(query: Query): Promise<Reply> {
    return this.buffer.resolve(query);
  }

}
