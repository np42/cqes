import { Fx }                                        from './Fx';
import { Handler, FxMessageHandler, MessageHandler } from './CommandBus';
import { AMQPInCommand }                             from './AMQPCommand';
import * as amqp                                     from 'amqplib';

type FxConnection = Fx<any, amqp.Connection>;
type FxChannel = Fx<amqp.Connection, amqp.Channel>;

export interface Config {
  name: string;
  url:  string;
}

export class AMQPBus {

  private url:        string;
  private connection: FxConnection;
  private channels:   Map<string, FxChannel>;
  private consumers:  Set<any>;

  constructor(config: Config) {
    this.url       = config.url;
    this.channels  = new Map();
    this.consumers = new Set();
  }

  public start() {
    if (this.connection != null) return Promise.resolve(true);
    const name = 'AMQP.Connection';
    const url = this.url;
    this.connection =
      new Fx((_: any, fx: FxConnection): Promise<amqp.Connection> => <any>amqp.connect(url), { name })
      .and(async (connection, fx) => {
        connection.on('error', (error: any) => fx.failWith(error));
        connection.on('close', () => fx.failWith(new Error('AMQP: Connection close')));
        return connection;
      });
    for (const [consumer] of this.consumers) consumer();
    return Promise.resolve(true);
  }

  public stop() {
    if (this.connection == null) return Promise.resolve();
    for (const [queue, channel] of this.channels)
      channel.abort();
    this.channels = new Map();
    this.connection = null;
  }

  private getChannel(queue: string, options: any) {
    const channel = this.channels.get(queue);
    if (channel != null) return channel;
    this.channels.set(queue, this.connection.pipe(async connection => {
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(queue, options);
      return channel;
    }, { name: 'AMQP.Channel.' + queue }));
    return this.channels.get(queue);
  }

  protected consume(queue: string, handler: Handler<any>, options: any) {
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
    const consumer = () => {
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
      }, { name: 'AMQP.Consumer.' + queue }).open();
    };
    this.consumers.add(consumer);
    if (this.connection != null) consumer();
  }

  protected publish(queue: string, message: Buffer, options: any) {
    if (this.connection == null) throw new Error('Not connected');
    if (options == null)         options = {};
    if (options.queue == null)   options.queue = queue;
    if (options.channel == null) options.channel = {};
    return this.getChannel(options.queue, options.channel).do(async channel => {
      return channel.sendToQueue(queue, message, options);
    });
  }

}
