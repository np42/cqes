import { Fx }          from './Fx';
import { AMQPCommand } from './AMQPCommand';
import * as amqp       from 'amqplib';

type FxConnection = Fx<any, amqp.Connection>;
type FxChannel = Fx<amqp.Connection, amqp.Channel>;
export type FxMessageHandler = Fx<any, MessageHandler>;

export type MessageHandler = (message: any) => Promise<void>;

//export type Options = { channel: ChannelOptions, queue: QueueOptions, reply: any, Message: Serializable };
//export type ChannelOptions = { prefetch: number };
//export type QueueOptions = { durable: boolean, exclusive: boolean };

export class AMQPBus {

  private connection: FxConnection;
  private channels: Map<string, FxChannel>;

  constructor(url: string) {
    this.connection =
      new Fx((_: any, fx: FxConnection): Promise<amqp.Connection> => <any>amqp.connect(url))
      .then(async (connection, fx) => {
        connection.on('close', () => fx.snap(new Error('Connection close')));
        return connection;
      })
      .open();
    this.channels = new Map();
  }

  getChannel(queue: string, options: any) {
    const channel = this.channels.get(queue);
    if (channel != null) return channel;
    this.channels.set(queue, this.connection.pipe(async connection => {
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(queue, options);
      return channel;
    }));
    return this.channels.get(queue);
  }

  consume(queue: string, handler: MessageHandler | FxMessageHandler, options: any) {
    if (options == null)                 options = {};
    if (options.noAck == null)           options.noAck = false;
    if (options.Message == null)         options.Message = AMQPCommand;
    if (options.reply == null)           options.reply = (channel: amqp.Channel) =>
      (message: amqp.Message) => (method: string) => channel[method](message)
    if (options.channel == null)         options.channel = {};
    if (!(options.channel.prefetch > 0)) options.channel.prefetch = 1;
    if (options.queue == null)           options.queue = {};
    if (options.queue.durable == null)   options.queue.durable = true;
    const fxHandler = <FxMessageHandler>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return this.getChannel(queue, options.queue).pipe(async channel => {
      await channel.prefetch(options.channel.prefetch, false);
      const replier = options.reply(channel);
      return channel.consume(queue, rawMessage => {
        const message = new options.Message(rawMessage, replier(rawMessage));
        fxHandler.do(async (handler: MessageHandler) => handler(message));
      }, options);
    });
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
