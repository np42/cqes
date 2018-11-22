import { Logger }             from './Logger';
import { Translator }         from './Translator';
import { Command, InCommand } from './Command';
import { Reply }              from './Reply';

const CachingMap = require('caching-map');

interface CachingMap<K, V> {
  set(key: K, value: V, options?: { ttl?: number }): void;
  get(key: K): V;
}

export interface Config {
  name:     string;
  size?:    number;
  ttl?:     number;
  Command?: Translator<Command>;
  Reply?:   Translator<Reply>;
};

export class Debouncer {

  private logger:  Logger;
  private waiting: CachingMap<string, Array<InCommand>>;
  private command: Translator<Command>;
  private reply:   Translator<Reply>;
  private ttl:     number;

  constructor(config: Config) {
    this.logger  = new Logger(config.name + '.Debouncer', 'magenta');
    this.waiting = new CachingMap(config.size >= 0 ? config.size : null);
    this.command = new Translator(config.Command);
    this.reply   = new Translator(config.Reply);
    this.ttl     = config.ttl >= 0 ? config.ttl : null;
  }

  public async satisfy(command: InCommand, handler: (command: Command) => Promise<Reply>): Promise<void> {
    this.logger.log('Receive Command %s : %s', command.key, command.order);
    const xCommand = <Command>this.command.decode(command);
    const xReply   = await handler(xCommand);
    if (xReply == null) return command.reject(null);
    const reply    = <Reply>this.reply.encode(xReply);
    command[reply.status](reply.data);
  }

}
