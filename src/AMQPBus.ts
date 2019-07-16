import { Fx }           from './Fx';
import * as Element     from './Element'
import * as amqp        from 'amqplib';
import { merge }        from './merge';

export type FxConnection = Fx<any, amqp.Connection>;
type FxChannel = Fx<amqp.Connection, amqp.Channel>;

export interface props extends Element.props {
  url: string;
  consumer?: { channel: PropsChannel, queue: PropsQueue };
  replier?: PropsReplier
}

interface PropsChannel {
  prefetch: number;
}

interface PropsQueue {
  maxPriority?: number;
}

interface PropsReplier {
  channel: { prefetch: number };
  queue: { exclusive: boolean, durable: boolean };
  Message: amqp.Message;
}

const CONSUMER_CHANNEL_DEFAULT = { prefetch: 10 }
const CONSUMER_QUEUE_DEFAULT = {}
const CONSUMER_DEFAULT = { queue: CONSUMER_QUEUE_DEFAULT, channel: CONSUMER_CHANNEL_DEFAULT };

export class AMQPBus extends Element.Element {
  protected props:    props;
  protected context:  string;
  private url:        string;
  private connection: FxConnection;
  private channels:   Map<string, FxChannel>;
  private consumers:  Set<any>;

  constructor(props: props) {
    super(props);
    this.props          = props;
    this.context        = props.context;
    this.url            = props.url;
    this.props.consumer = merge(CONSUMER_DEFAULT, props.consumer || {});
    this.channels       = new Map();
    this.consumers      = new Set();
  }

  public start() {
    this.logger.debug('Starting %s@%s', this.context, this.constructor.name);
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
    for (const [consumer] of this.consumers.entries()) consumer();
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

  protected consume(queue: string, handler: (message: amqp.Message) => void, options: any) {
    if (options == null)                 options = {};
    if (options.noAck == null)           options.noAck = false;
    if (options.reply == null)           options.reply = (channel: amqp.Channel) =>
      (message: amqp.Message) => (method: string) => channel[method](message)
    if (options.channel == null)         options.channel = {};
    if (!options.channel.arguments)      options.channel.arguments = {};
    if (!options.channel.arguments['x-priority']) options.channel.arguments['x-priority'] = 10;
    if (!(options.channel.prefetch > 0)) options.channel.prefetch = 1;
    if (options.queue == null)           options.queue = {};
    if (options.queue.durable == null)   options.queue.durable = true;
    const fxHandler = <any>(handler instanceof Fx ? handler : Fx.create(handler)).open();
    return new Promise((resolve, reject) => {
      const consumer = () => {
        this.logger.log('Listening to %s: %j', queue, options);
        const connection = this.getChannel(queue, options.queue).pipe(async (channel, fx) => {
          await channel.prefetch(options.channel.prefetch, false);
          const replier = options.noAck ? null : options.reply(channel);
          let active = true;
          const subscription = await channel.consume(queue, message => {
            if (active) {
              Object.defineProperty(message, 'channel', { value: channel });
              fxHandler.do(async (handler: any) => handler(message));
            } else {
              channel.reject(message, true);
            }
          }, options.channel);
          fx.on('aborted', () => {
            active = false;
            channel.cancel(subscription.consumerTag);
          });
          return subscription;
        }, { name: 'AMQP.Consumer.' + queue }).open();
        resolve(connection);
        return connection;
      };
      this.consumers.add(consumer);
      if (this.connection != null) consumer();
    });
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
