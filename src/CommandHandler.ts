import * as Component    from './Component';
import * as Factory      from './Factory';

import { state   as S }  from './state';
import { command as C }  from './command';
import { event   as E }  from './event';

export interface props extends Component.props {
  events?:   { [name: string]: { new (data: any): any } }
  commands?: { [name: string]: { new (data: any): any } }
  factory?:  Factory.Factory;
  topics?:   Array<string>;
}

export class CommandHandler extends Component.Component {
  protected events:   { [name: string]: { new (data: any): any } };
  protected commands: { [name: string]: { new (data: any): any } };
  protected factory:  Factory.Factory;
  protected topics:   Array<string>;

  static noop(): Array<E> {
    return [];
  }

  constructor(props: props) {
    super(props);
    this.commands = props.commands || {};
    this.events   = props.events   || {};
    this.topics   = props.topics   || [this.context + '.' + this.module];
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;
    return new Promise((resolve, reject) => super.start().then(() => {
      if (!this.bus.command) {
        this.logger.error('Command Bus not enabled');
        return resolve(false);
      }
      Promise.all(this.topics.map((topic: string) => {
        return this.bus.command.listen(topic, async command => {
          const type = this.commands[command.order];
          if (type == null) return this.bus.command.relocate(command, topic + '.untyped');
          command.data = new type(command.data);
          const state = await this.factory.get(command.id);
          try {
            const events = await this.handle(state, command);
            if (events.length === 0) {
              this.bus.command.discard(command);
            } else {
              const stream = this.module;
              const id = command.id;
              const expectedRevision = state.revision + 1;
              try {
                const position = await this.bus.event.emit(stream, id, expectedRevision, events);
                this.bus.command.discard(command);
              } catch (e) {
                this.logger.warn(e);
                this.bus.command.replay(command);
              }
            }
          } catch (e) {
            this.logger.error(e);
            command.meta.error = e;
            this.bus.command.relocate(command, topic + '.failed');
          }
        })
      }))
        .then(() => resolve(true))
        .catch(e => {
          this.logger.error(e);
          resolve(false);
        })
    }));
  }

  public async stop(): Promise<void> {
    if (!this.running) return ;
    return super.stop();
  }

  public async handle(state: S, command: C): Promise<Array<E>> {
    if (command.order in this) {
      this.logger.debug('Handle %s : %s %j', command.id, command.order, command.data);
      let result = await this[command.order](state, command);
      if (result == null) result = CommandHandler.noop();
      else if (!(result instanceof Array)) result = [result];
      return result.map((event: any) => {
        if (event instanceof E) return event;
        return new E(event.constructor.name, event);
      });
    } else {
      this.logger.log('Skip %s : %s %j', command.id, command.order, command.data);
      return CommandHandler.noop();
    }
  }

}
