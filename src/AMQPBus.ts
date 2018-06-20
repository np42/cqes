import { Fx } from './Fx';
import * as amqplib from 'amqplib';

export class AMQPBus {

  constructor() {
    this.connection =
      new Fx(() => amqp.connect(url))
      .then(async (connection, fx) => {
        connection.on('close', () => fx.snap('Connection close'));
        return connection;
      })
      .open();
    this.channels = new Map();
  }

  getChannel(queue, options) {
    const channel = this.channels.get(queue);
    if (channel != null) return channel;
    this.channels.set(queue, this.connection.pipe(async connection => {
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(queue, options);
      return channel;
    }));
    return this.channels.get(queue);
  }

  consume(queue, handler, options) {
    if (options == null)                 options = {};
    if (options.noAck == null)           options.noAck = false;
    if (options.Message == null)         options.Message = AMQPCommand;
    if (options.channel == null)         options.channel = {};
    if (!(options.channel.prefetch > 0)) options.channel.prefetch = 1;
    if (options.queue == null)           options.queue = {};
    if (options.queue.durable == null)   options.queue.durable = true;
    if (!(handler instanceof Fx)) handler = Fx.create(handler).open();
    return this.getChannel(queue, options.queue).pipe(async channel => {
      await channel.prefetch(options.channel.prefetch, false);
      const replier = options.reply != null ? options.reply(channel)
        : message => method => channel[method](message);
      return channel.consume(queue, rawMessage => {
        const message = new options.Message(rawMessage, replier(rawMessage));
        handler.do(async handler => handler(message));
      }, options);
    });
  }

  publish(queue, message, options) {
    if (options == null)         options = {};
    if (options.queue == null)   options.queue = queue;
    if (options.channel == null) options.channel = {};
    return this.getChannel(options.queue, options.channel).do(async channel => {
      return channel.sendToQueue(queue, message, options);
    });
  }

}
