import { CommandBus, Handler }   from './CommandBus';
import { InCommand, OutCommand } from './Command';
import { AMQPBus }               from './AMQPBus';
import { Reply }                 from './Reply';

export interface Config {
  name: string;
  url: string;
};

export class AMQPCommandBus extends AMQPBus implements CommandBus {

  constructor(config: Config) {
    super(config);
  }

  public listen(topic: string, handler: Handler<InCommand>) {
    const options = { channel: { prefetch: 10 } };
    return this.consume(topic + '.Command', handler, options);
  }

  public async request(request: OutCommand) {
    const options = { persistent: true };
    const result = await this.publish(request.key + '.Command', request.serialize(), options);
    return new Reply(null, result);
  }

}
