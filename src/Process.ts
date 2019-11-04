import * as Component              from './Component';
import * as Context                from './Context';

import { CommandBus }              from './CommandBus';
import { QueryBus }                from './QueryBus';
import { EventBus }                from './EventBus';
import { StateBus }                from './StateBus';

import * as Manager                from './Manager';
import * as View                   from './View';
import * as Projection             from './Projection';
import * as Service                from './Service';

import { clone, merge
       , isConstructor }           from './util';

import { hostname, userInfo }      from 'os';
import * as fs                     from 'fs';
import { join, dirname, basename } from 'path';

const yaml                         = require('js-yaml');

function safeRequire(path: string) {
  try {
    return require(path);
  } catch (e) {
    if (e.code != 'MODULE_NOT_FOUND') throw e;
    if (!~e.toString().indexOf(path)) throw e;
    return {};
  }
}

export interface props {
  name:    string;
  root?:   string;
  config?: string;
}

interface RecordMap<T = any> { [name: string]: T; }

export class Process extends Component.Component {
  protected root:       string;
  protected configFile: string;
  protected vars:       Map<string, string>;
  protected contexts:   Map<string, Context.ContextProps | Context.Context>;

  static async readYaml(filepath: string) {
    return new Promise((resolve, reject) => {
      return fs.readFile(filepath, (err, content) => {
        if (err) return reject(err);
        try {
          const config = yaml.safeLoad(content.toString());
          return resolve(config);
        } catch (e) {
          return reject(e);
        }
      });
    });
  }

  constructor(props: props) {
    if (props.name == null) throw new Error('Need a <name> to start');
    super({ name: props.name, logger: 'Process:' + props.name });
    this.root       = props.root || process.cwd();
    this.configFile = join(this.root, props.config || 'cqesconfig.yml');
    this.vars       = new Map();
    this.contexts   = new Map();
    this.loadConstants();
  }

  protected loadConstants() {
    const environmentsAliases = { dev: 'development', prod: 'production' };
    const environRaw  = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown').toLowerCase();
    const environ     = environmentsAliases[environRaw] || environRaw;
    if (environ == 'unknown')
      this.logger.warn('Unknown environment type (e.g. developement, staging, production)');
    process.env.NODE_ENV = environ;
    this.vars.set('hostname', hostname());
    this.vars.set('procuser', userInfo().username);
    this.vars.set('launcher', process.stdin.isTTY ? 'console' : 'daemon');
    this.vars.set('environment', environ);
  }

  public async start() {
    const promises = [];
    const timeouts = <any>[];
    this.logger.log('%bold', 'Load Config file');
    await this.loadConfig();
    this.logger.log('%bold', 'Load Contexts');
    await this.loadContexts();
    this.logger.log('%bold', 'Start Components');
    await this.startComponents();
    this.catchErrors();
    this.logger.log('%bold', 'Process Ready');
  }

  protected async loadConfig() {
    const configFileContent = await Process.readYaml(this.configFile);
    const contexts = configFileContent[this.name] || {};
    for (const contextName in contexts) {
      this.logger.log('%magenta %cyan found', 'Context', contextName);
      const props: Context.ContextProps = contexts[contextName] || {};
      props.name = contextName;
      this.setDefaultContextHandlersProps(props);
      this.contexts.set(contextName, props);
    }
  }

  protected setDefaultContextHandlersProps(props: Context.ContextProps) {
    if (props.managers == null)    props.managers    = {};
    if (props.views == null)       props.views       = {};
    if (props.services == null)    props.services    = {};
    if (props.projections == null) props.projections = {};
  }

  protected loadContexts() {
    for (const [contextName, contextProps] of this.contexts) {
      if (contextProps instanceof Context.Context) continue ;
      const context = new Context.Context(contextProps);
      context.managers    = this.getContextManagers(contextProps, contextProps.managers);
      context.views       = this.getContextViews(contextProps, contextProps.views);
      context.projections = this.getContextProjections(contextProps, contextProps.projections);
      context.services    = this.getContextServices(contextProps, contextProps.services);
      this.contexts.set(contextName, context);
    }
  }

  protected getContextManagers(context: Context.ContextProps, managersProps: RecordMap) {
    return Object.keys(managersProps).reduce((result: Map<string, Manager.Manager>, name: string) => {
      const managerProps = managersProps[name];
      const commonProps  = { context: context.name, name };

      const events = this.getTypes(context.name, name, 'events');
      const commandBuses = (managerProps.listen || [name])
        .reduce((result: Manager.CommandBuses, channel: string) => {
          const commandBusProps = { ...commonProps, ...context.CommandBus, ...managerProps.CommandBus };
          result[channel] = this.getCommandBus(commandBusProps, channel);
          return result;
        }, {});
      const eventBusProps = { ...commonProps, ...context.EventBus, ...managerProps.EventBus };
      const eventBus = this.getEventBus(eventBusProps, name);
      const noopBus  = this.getEventBus(eventBusProps, 'NoOp');
      const stateBusProps = { ...commonProps, ...context.StateBus, ...managerProps.StateBus };
      const stateBus = this.getStateBus({ ...stateBusProps, eventBus }, name);

      const { commandHandlers, domainHandlers } = this.getManagerHandlers(context.name, name, managerProps);
      const props   = { ...commonProps, commandBuses, stateBus, noopBus, eventBus, events
                      , commandHandlers, domainHandlers
                      }
      const manager = new Manager.Manager(props);
      this.logger.log('%red %cyan.%cyan found', 'Manager', context.name, name);
      result.set(name, manager);
      return result;
    }, new Map());
  }

  protected getContextViews(context: Context.ContextProps, viewsProps: RecordMap) {
    return Object.keys(viewsProps).reduce((result: Map<string, View.View>, name: string) => {
      const viewProps   = viewsProps[name];
      const commonProps = { context: context.name, name };

      const eventBuses = (viewProps.psubscribe || [name])
        .reduce((result: View.EventBuses, stream: string) => {
          const eventBusProps = { ...commonProps, ...context.EventBus, ...viewProps.EventBus };
          result[stream] = this.getEventBus(eventBusProps, stream);
          return result;
        }, {});
      const queryBusProps = { ...commonProps, ...context.QueryBus, ...viewProps.QueryBus };
      const queryBus = this.getQueryBus({ ...queryBusProps, mode: 'server' }, name);

      const { queryHandlers, updateHandlers } = this.getViewHandlers(context.name, name, viewProps);
      const props = { ...commonProps, queryBus, eventBuses, queryHandlers, updateHandlers };
      const view  = new View.View(props);
      this.logger.log('%blue %cyan.%cyan found', 'View', context.name, name);
      result.set(name, view);
      return result;
    }, new Map());
  }

  protected getContextProjections(context: Context.ContextProps, projectionsProps: RecordMap) {
    return new Map();
  }

  protected getContextServices(context: Context.ContextProps, servicesProps: RecordMap) {
    return Object.keys(servicesProps).reduce((result: Map<string, Service.Service>, name: string) => {
      const serviceProps = servicesProps[name];
      const commonProps  = { context: context.name, name };

      const commandBuses = (serviceProps.targets || [name])
        .reduce((result: Manager.CommandBuses, channel: string) => {
          const commandBusProps = { ...commonProps, ...context.CommandBus, ...serviceProps.CommandBus };
          result[channel] = this.getCommandBus(commandBusProps, channel);
          return result;
        }, {});
      const queryBuses = (serviceProps.views || [])
        .reduce((result: Service.QueryBuses, view: string) => {
          const serverQueryBusProps = (<any>context.views[view]).QueryBus || {};
          const queryBusProps = { ...commonProps, ...context.QueryBus
                                , ...serverQueryBusProps, ...serviceProps.QueryBus };
          result[view] = this.getQueryBus({ ...queryBusProps, mode: 'client' }, view);
          return result;
        }, {});
      const eventBuses = ['@DeadLetter'].concat(serviceProps.psubscribe || [name])
        .reduce((result: Service.EventBuses, stream: string) => {
          const eventBusProps = { ...commonProps, ...context.EventBus, ...serviceProps.EventBus };
          result[stream] = this.getEventBus(eventBusProps, stream);
          return result;
        }, {});

      const props = { ...commonProps, ...serviceProps, eventBuses, commandBuses, queryBuses };
      const path  = join(this.root, context.name, name + '.Service');
      const SubService = require(path)[name];
      if (SubService == null)
        throw new Error('Missing ' + name + ' in ' + path);
      const service = new SubService(props);
      if (!(service instanceof Service.Service))
        throw new Error('Service ' + name + ' must be tye of Service');
      this.logger.log('%yellow %cyan.%cyan found', 'Service', context.name, name);
      result.set(name, service);
      return result;
    }, new Map());
    return new Map();
  }

  protected getCommandBus(props: any, channel: string) {
    if (props.transport == null) props.transport = './bus/AMQP.CommandBus';
    const category = channel.split('.').shift();
    const commands = this.getTypes(props.context, category, 'commands');
    return new CommandBus({ ...props, channel, commands });
  }

  protected getQueryBus(props: any, view: string) {
    if (props.transport == null) props.transport = './bus/HTTP.QueryBus';
    const queries = this.getTypes(props.context, view, 'queries');
    const replies = this.getTypes(props.context, view, 'replies');
    return new QueryBus({ ...props, view, queries, replies });
  }

  protected getEventBus(props: any, stream: string) {
    if (props.transport == null) props.transport = './bus/MySQL_Redis.EventBus';
    const category = stream.split('-').shift();
    const events   = this.getTypes(props.context, category, 'events');
    return new EventBus({ ...props, stream, events });
  }

  protected getStateBus(props: any, type: string) {
    if (props.transport == null) props.transport = './bus/MySQL.StateBus';
    const states = this.getTypes(props.context, type, 'state');
    const state = states && states[type] || null;
    return new StateBus({ ...props, state });
  }

  protected getTypes(contextName: string, category: string, kind: string) {
    const path = join(this.root, contextName, category + '.' + kind);
    return safeRequire(path);
  }

  protected getManagerHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Manager');
    const { CommandHandlers, DomainHandlers } = require(path);
    if (!isConstructor(CommandHandlers))
      throw new Error('Constructor CommandHandlers from ' + path + ' expected');
    if (!isConstructor(DomainHandlers))
      throw new Error('Constructor DomainHandlers from ' + path + ' expected');
    const childProps      = { name: contextName + '.' + name, ...props };
    const commandHandlers = new CommandHandlers(childProps);
    const domainHandlers  = new DomainHandlers(childProps);
    return { commandHandlers, domainHandlers };
  }

  protected getViewHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.View');
    const { QueryHandlers, UpdateHandlers } = require(path);
    if (!isConstructor(QueryHandlers))
      throw new Error('Constructor QueryHandlers from ' + path + ' expected');
    if (!isConstructor(UpdateHandlers))
      throw new Error('Constructor UpdateHandlers from ' + path + ' expected');
    const childProps     = { name: contextName + '.' + name, ...props };
    const queryHandlers  = new QueryHandlers(childProps);
    const updateHandlers = new UpdateHandlers(childProps);
    return { queryHandlers, updateHandlers };
  }

  protected getProjectionHandlers(contextName: string, name: string) {

  }

  protected startComponents(): Promise<void> {
    const promises = <Array<Promise<void>>>[];
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, manager] of context.managers) promises.push(manager.start());
      for (const [name, view] of context.views) promises.push(view.start());
      for (const [name, projection] of context.projections) promises.push(projection.start());
      for (const [name, service] of context.services) promises.push(service.start());
    }
    return <any> Promise.all(promises);
  }

  protected catchErrors() {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
  }

  public async stop() {
    
  }

};
