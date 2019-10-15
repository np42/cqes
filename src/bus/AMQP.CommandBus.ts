import * as Component  from '../Component';
import * as CommandBus from '../CommandBus';
import { Command }     from '../Command';
import * as amqp       from 'amqplib';
import * as uuid       from 'uuid';

export type commandHandler = (command: Command<any>) => Promise<void>;

export interface Listener {
  queue:   string;
  handler: commandHandler
};

export interface props extends Component.props {
  AMQP: Config
};

export interface Config {
  url?:      string
  channel?:  amqp.Options.AssertQueue;
  publish?:  amqp.Options.Publish;
  prefetch?: number;
};

export class Transport extends Component.Component implements CommandBus.Transport {
  protected config:         Config;
  protected amqp:           amqp.Connection;
  protected lastConnection: number;
  protected connectFlag:    NodeJS.Timer;
  protected listeners:      Array<Listener>;
  protected channels:       Map<string, amqp.Channel>;

  constructor(props: props) {
    super(props);
    if (props.AMQP == null) props.AMQP = {};
    const defaultUrl = 'amqp://cqes:changeit@127.0.0.1/cqes-' + props.name.toLowerCase();
    if (props.AMQP.url == null) props.AMQP.url = defaultUrl;
    if (props.AMQP.channel == null) props.AMQP.channel = {};
    if (props.AMQP.channel.durable == null) props.AMQP.channel.durable = true;
    if (props.AMQP.channel.maxPriority === undefined) props.AMQP.channel.maxPriority = 10;
    if (props.AMQP.prefetch == null) props.AMQP.prefetch = 10;
    if (props.AMQP.publish == null) props.AMQP.publish = {};
    if (props.AMQP.publish.persistent == null) props.AMQP.publish.persistent = true;
    this.config    = props.AMQP;
    this.listeners = [];
    this.channels  = new Map();
  }

  public start(): Promise<void> {
    return this.connect();
  }

  protected async connect(): Promise<void> {
    this.lastConnection = Date.now();
    const connection = await amqp.connect(this.config.url);
    this.amqp = connection;
    this.amqp.on('error', () => this.reconnect());
    this.amqp.on('close', () => this.reconnect());
    await Promise.all(this.listeners.map(({ queue, handler }) => this.bind(queue, handler)));
  }

  public async listen(queue: string, handler: commandHandler): Promise<CommandBus.Subscription> {
    const subscription = { abort: () => this.unbind(queue, handler) };
    this.listeners.push({ queue, handler });
    if (this.amqp != null) await this.bind(queue, handler);
    return Promise.resolve(subscription);
  }

  protected async bind(queue: string, handler: commandHandler): Promise<void> {
    const channel = await this.getChannel(queue);
    return <any> channel.consume(queue, async message => {
      try {
        const payload = JSON.parse(message.content.toString());
        const { category, order, data, meta } = payload;
        const streamId = payload.streamId || uuid();
        const command  = new Command(category, streamId, order, data, meta);
        try {
          await handler(command);
          await channel.ack(message);
        } catch (err) {
          this.logger.warn('Command rejected', err);
          await channel.nack(message);
        }
      } catch (err) {
        this.logger.warn('Command received discarded', err);
        await channel.ack(message);
      }
    });
  }

  protected async getChannel(queue: string): Promise<amqp.Channel> {
    if (this.channels.has(queue)) return this.channels.get(queue);
    this.logger.log('Create Channel %red', queue);
    const channel = await this.amqp.createConfirmChannel();
    await channel.assertQueue(queue, this.config.channel);
    await channel.prefetch(this.config.prefetch, false);
    this.channels.set(queue, channel);
    return channel;
  }

  public async send(command: Command<any>): Promise<void> {
    const channel = await this.getChannel(this.name);
    const content = Buffer.from(JSON.stringify(command));
    const sent    = await channel.publish('', command.category, content, this.config.publish);
    if (sent) return Promise.resolve();
    return new Promise(resolve => { channel.once('drain', () => resolve()); });
  }

  protected async reconnect(): Promise<void> {
    await this.disconnect();
    const now = Date.now();
    const delay = now - (this.lastConnection + 5000);
    if (delay > 10) {
      clearTimeout(this.connectFlag);
      this.connectFlag = setTimeout(() => this.reconnect(), delay);
    } else {
      this.connect();
    }
  }

  protected unbind(queue: string, handler: commandHandler): Promise<void> {
    this.listeners = this.listeners.filter(listener => {
      const match = listener.queue === queue && listener.handler === handler;
      if (match) {

      }
      return match;
    });
    return Promise.resolve();
  }

  protected async disconnect(): Promise<void> {
    this.channels.clear();
    await this.amqp.close();
    this.amqp = null;
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }
}

