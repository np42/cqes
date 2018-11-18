import { CommandBus, Handler }   from './CommandBus'
import { InCommand, OutCommand } from './Command'
import { AMQPBus }               from './AMQPBus'

export interface Config {
  name: string;
  url: string;
};

export class AMQPCommandBus extends AMQPBus implements CommandBus {

  constructor(config: Config) {
    super(config)
  }

  public listen(topic: string, handler: Handler<InCommand>) {
    const options = { channel: { prefetch: 10 } }
    return this.consume(topic + '.Command', handler, options)
  }

  public request(request: OutCommand) {
    const options = { persistent: true }
    return this.publish(request.key + '.Command', request.serialize(), options)
  }

}
