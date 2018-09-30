import { CommandBus, Handler }   from './CommandBus'
import { InCommand, OutCommand } from './Command'
import { AMQPBus }               from './AMQPBus'

const PREFIX = '~Command-'

export class AMQPCommandBus extends AMQPBus implements CommandBus {

  constructor(url: string) {
    super(url)
  }

  public listen(topic: string, handler: Handler<InCommand<any>>) {
    const options = { channel: { prefetch: 10 } }
    return this.consume(PREFIX + topic, handler, options)
  }

  public command(request: OutCommand<any>) {
    const options = { persistent: true }
    return this.publish(PREFIX + request.topic, request.serialize(), options)
  }

}
