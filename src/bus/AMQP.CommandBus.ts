import * as Component  from '../Component';
import * as CommandBus from '../CommandBus';
import { Command }     from '../Command';
import * as amqp       from 'amqplib';
import * as uuid       from 'uuid';

export type commandHandler  = (command: Command<any>) => Promise<void>;
export type ConcurencyError = CommandBus.ConcurencyError;

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
  protected channels:       Map<string, amqp.Channel | Array<any>>;

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
    if (this.connectFlag) clearTimeout(this.connectFlag);
    this.logger.log('Connecting to %s', this.config.url);
    const connection = await amqp.connect(this.config.url);
    this.amqp = connection;
    this.amqp.on('error', (err: Error) => {
      this.logger.error('Received', err);
      this.reconnect()
    });
    this.amqp.on('close', (err: Error) => {
      this.logger.warn('Connection lost');
      this.amqp = null;
      this.reconnect()
    });
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
    const ack = async (message: amqp.Message, fn?: () => void) => {
      if (fn) fn();
      try { await channel.ack(message); }
      catch (e) { this.logger.error(e); this.reconnect(); }
    };
    const nack = async (message: amqp.Message, requeue: boolean, fn?: () => void) => {
      if (fn) fn();
      try { await channel.nack(message, false, requeue); }
      catch (e) { this.logger.error(e); this.reconnect(); }
    };
    return <any> channel.consume(queue, async message => {
      let payload = null;
      try { payload = JSON.parse(message.content.toString()); }
      catch (err) { return ack(message, () => this.logger.warn('Command received discarded', err)); }
      const { category, order, data, meta } = payload;
      const streamId = payload.streamId || uuid();
      const command  = new Command(category, streamId, order, data, meta);
      try { await handler(command); }
      catch (e) {
        const err = <ConcurencyError>e;
        if (err.retry) return nack(message, true, () => this.logger.log('Command retry (OCC) %s', e))
        else return nack(message, false, () => this.logger.warn('Command rejected', err))
      }
      return ack(message)
    });
  }

  protected getChannel(queue: string): Promise<amqp.Channel> {
    return new Promise((resolve, reject) => {
      const channel = this.channels.get(queue);
      if (channel instanceof Array) return channel.push({ resolve, reject });
      if (channel != null) return resolve(channel);
      this.channels.set(queue, [{ resolve, reject }]);
      this.logger.log('Create Channel %red', queue);
      return (async function () {
        try {
          const channel = await this.amqp.createConfirmChannel();
          await channel.assertQueue(queue, this.config.channel);
          await channel.prefetch(this.config.prefetch, false);
          const waiters = this.channels.get(queue);
          this.channels.set(queue, channel);
          waiters.forEach(({ resolve }: any) => resolve(channel));
        } catch (e) {
          this.channels.get(queue).forEach(({ reject }: any) => reject(e));
        }
      }).call(this);
    });
  }

  public async send(command: Command<any>): Promise<void> {
    const queue   = command.meta && command.meta.queue || command.category;
    const channel = await this.getChannel(queue);
    const content = Buffer.from(JSON.stringify(command));
    const sent    = await channel.publish('', command.category, content, this.config.publish);
    if (sent) return Promise.resolve();
    return new Promise(resolve => { channel.once('drain', () => resolve()); });
  }

  protected async reconnect(): Promise<void> {
    if (this.connectFlag != null) return ;
    await this.disconnect();
    const now = Date.now();
    const delay = (this.lastConnection + 5000) - now;
    if (delay > 10) {
      clearTimeout(this.connectFlag);
      this.logger.log('Reconnecting in %sms', delay);
      this.connectFlag = setTimeout(() => {
        this.connectFlag = null;
        this.reconnect()
      }, delay);
    } else {
      this.connect();
    }
  }

  protected unbind(queue: string, handler: commandHandler): Promise<void> {
    this.listeners = this.listeners.filter(listener => {
      const match = listener.queue === queue && listener.handler === handler;
      if (match) {
        this.logger.todo();
      }
      return match;
    });
    return Promise.resolve();
  }

  protected async disconnect(): Promise<void> {
    this.channels.clear();
    if (this.amqp != null) {
      try { await this.amqp.close(); }
      catch (e) { this.logger.error(e); }
      this.amqp = null;
    }
  }

  public stop(): Promise<void> {
    return this.disconnect();
  }
}

