import { AMQPBus, MessageHandler, FxMessageHandler } from './AMQPBus';
import { Command }                                   from './Command';

export class AMQPCommandBus extends AMQPBus {

  constructor(url: string) {
    super(url)
  }

  listen(topic: string, handler: MessageHandler | FxMessageHandler) {
    const options = { channel: { prefetch: 10 } };
    return this.consume(topic, handler, options);
  }

  command(request: Command) {
    const options = { persistent: true };
    return this.publish(request.topic, request.serialize(), options);
  }

}
