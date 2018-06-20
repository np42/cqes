import { AMQPBus } from './AMQPBus';

export class AMQPCommandBus extends AMQPBus {

  constructor(url) {
    super(url)
  }

  listen(topic, handler) {
    const options = { channel: { prefetch: 10 } };
    return this.consume(topic, handler, options);
  }

  command(request) {
    const options = { persistent: true };
    return this.publish(request.topicId, request.serialize(), options);
  }

}
