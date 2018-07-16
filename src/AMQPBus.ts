import { Fx }                                        from './Fx';
import { Handler, FxMessageHandler, MessageHandler } from './CommandBus';
import { AMQPInCommand }                             from './AMQPCommand';
import * as amqp                                     from 'amqplib';

type FxConnection = Fx<any, amqp.Connection>;
type FxChannel = Fx<amqp.Connection, amqp.Channel>;

//export type Options = { channel: ChannelOptions, queue: QueueOptions, reply: any, Message: Serializable };
//export type ChannelOptions = { prefetch: number };
//export type QueueOptions = { durable: boolean, exclusive: boolean };

export class AMQPBus {

  private connection: FxConnection;
  private channels: Map<string, FxChannel>;

  constructor(url: string) {
    const name  = 'AMQP.Connection';
    this.connection =
      new Fx((_: any, fx: FxConnection): Promise<amqp.Connection> => <any>amqp.connect(url), { name })
      .and(async (connection, fx) => {
        connection.on('error', (error: any) => fx.failWith(error));
        connection.on('close', () => fx.failWith(new Error('AMQP: Connection close')));
        return connection;
      });
    this.channels = new Map();
  }

  getChannel(queue: string, options: any) {
    const channel = this.channels.get(queue);
    if (channel != null) return channel;
    this.channels.set(queue, this.connection.pipe(async connection => {
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(queue, options);
      return channel;
    }, { name: 'AMQP.Channel' }));
    return this.channels.get(queue);
  }

  consume(queue: string, handler: Handler<any>, options: any) {
    if (options == null)                 options = {};
    if (options.noAck == null)           options.noAck = false;
    if (options.Message == null)         options.Message = AMQPInCommand;
    if (options.reply == null)           options.reply = (channel: amqp.Channel) =>
      (message: amqp.Message) => (method: string) => channel[method](message)
    if (options.channel == null)         options.channel = {};
    if (!(options.channel.prefetch > 0)) options.channel.prefetch = 1;
    if (options.queue == null)           options.queue = {};
    if (options.queue.durable == null)   options.queue.durable = true;
    const fxHandler = <FxMessageHandler<any>>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return this.getChannel(queue, options.queue).pipe(async (channel, fx) => {
      await channel.prefetch(options.channel.prefetch, false);
      const replier = options.noAck ? null : options.reply(channel);
      let active = true;
      const subscription = await channel.consume(queue, rawMessage => {
        if (active) {
          const message = new options.Message(rawMessage, options.noAck ? null : replier(rawMessage));
          fxHandler.do(async (handler: MessageHandler<any>) => handler(message));
        } else {
          channel.reject(rawMessage, true);
        }
      }, options);
      fx.on('aborted', () => {
        active = false;
        channel.cancel(subscription.consumerTag);
      });
      return subscription;
    }, { name: 'AMQP.Consumer' }).open();
  }

  publish(queue: string, message: Buffer, options: any) {
    if (options == null)         options = {};
    if (options.queue == null)   options.queue = queue;
    if (options.channel == null) options.channel = {};
    return this.getChannel(options.queue, options.channel).do(async channel => {
      return channel.sendToQueue(queue, message, options);
    });
  }

}
