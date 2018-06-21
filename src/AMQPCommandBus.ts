import { CommandBus, Handler }   from './CommandBus';
import { InCommand, OutCommand } from './Command';
import { AMQPBus }               from './AMQPBus';

export class AMQPCommandBus extends AMQPBus implements CommandBus {

  constructor(url: string) {
    super(url)
  }

  listen(topic: string, handler: Handler<InCommand<any>>) {
    const options = { channel: { prefetch: 10 } };
    return this.consume(topic, handler, options);
  }

  command(request: OutCommand<any>) {
    const options = { persistent: true };
    return this.publish(request.topic, request.serialize(), options);
  }

}
