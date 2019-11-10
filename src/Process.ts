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
       , isConstructor }           from 'cqes-util';

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

interface RecordMap<T = any> { [name: string]: T; };
interface BusEndpoint { name: string, slot: string };

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
      if (managerProps.listen == null) managerProps.listen = [name];
      const commonProps   = { context: context.name, name };
      const commandBuses  = this.getCommandBuses(context.name, name, managerProps.listen);
      const eventBusProps = { ...commonProps, ...context.EventBus, ...managerProps.EventBus };
      const events        = this.getTypes(context.name, name, 'events');
      const eventBus      = this.getEventBus(eventBusProps, context.name, name);
      const noopBus       = this.getEventBus(eventBusProps, context.name, 'NoOp');
      const stateBusProps = { ...commonProps, ...context.StateBus, ...managerProps.StateBus };
      const stateBus      = this.getStateBus({ ...stateBusProps, eventBus }, context.name, name);
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
      if (viewProps.psubscribe == null) viewProps.psubscribe = [];
      const commonProps = { context: context.name, name };
      const eventBuses  = this.getEventBuses(context.name, name, viewProps.psubscribe);
      const queryBusProps = { ...commonProps, ...context.QueryBus, ...viewProps.QueryBus };
      const queryBus    = this.getQueryBus({ ...queryBusProps, mode: 'server' }, context.name, name);
      const { queryHandlers, updateHandlers } = this.getViewHandlers(context.name, name, viewProps);
      const props = { ...commonProps, queryBus, eventBuses, queryHandlers, updateHandlers };
      const view  = new View.View(props);
      this.logger.log('%blue %cyan.%cyan found', 'View', context.name, name);
      result.set(name, view);
      return result;
    }, new Map());
  }

  protected getContextServices(context: Context.ContextProps, servicesProps: RecordMap) {
    return Object.keys(servicesProps).reduce((result: Map<string, Service.Service>, name: string) => {
      const serviceProps = servicesProps[name];
      if (serviceProps.targets == null) serviceProps.targets = [];
      if (serviceProps.views == null) serviceProps.views = [];
      if (serviceProps.psubscribe == null) serviceProps.psubscribe = [];
      serviceProps.psubscribe.unshift('@DeadLetter');
      const commandBuses = this.getCommandBuses(context.name, name, serviceProps.targets);
      const queryBuses   = this.getQueryBuses(context.name, name, serviceProps.views, { mode: 'client' });
      const eventBuses   = this.getEventBuses(context.name, name, serviceProps.psubscribe);
      const props = { context: context.name, name, ...serviceProps, eventBuses, commandBuses, queryBuses };
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
  }

  protected getContextProjections(context: Context.ContextProps, projectionsProps: RecordMap) {
    return new Map();
  }

  protected getCommandBuses(fromContext: string, name: string, views: Array<string>, extra?: any) {
    return this.getBuses<CommandBus>('CommandBus', fromContext, name, views, extra);
  }

  protected getQueryBuses(fromContext: string, name: string, views: Array<string>, extra?: any) {
    return this.getBuses<QueryBus>('QueryBus', fromContext, name, views, extra);
  }

  protected getEventBuses(fromContext: string, name: string, views: Array<string>, extra?: any) {
    return this.getBuses<EventBus>('EventBus', fromContext, name, views, extra);
  }

  protected getBuses<T>(busType: string, from: string, name: string, targets: Array<string>, extra?: any) {
    const result = <RecordMap<T>>{};
    for (const path of targets) {
      const { context, slot, as } = this.getBusPathContext(path, from);
      const props = { name, context: from, ...extra, ...context[busType] };
      result[as] = <T>this['get' + busType](props, context.name, slot);
    }
    return result;
  }

  protected getBusPathContext(path: string, defaultContextName: string) {
    const match = /(?:([A-Z][a-zA-Z0-9]*)\.)?([A-Z][a-zA-Z0-9\-]*)(?::([A-Z][a-zA-Z0-9]*))?/.exec(path);
    const name  = match[1] || defaultContextName;
    const slot  = match[2];
    const as    = match[3] || match[2];
    const context = <Context.ContextProps>this.contexts.get(name);
    return { context, as, slot };
  }

  protected getCommandBus(props: any, contextName: string, channel: string) {
    const transport = props.transport || './bus/AMQP.CommandBus';
    const category  = channel.split('-').shift();
    const commands  = this.getTypes(contextName, category, 'commands');
    return new CommandBus({ ...props, transport, channel, commands });
  }

  protected getQueryBus(props: any, contextName: string, view: string) {
    const transport = props.transport || './bus/HTTP.QueryBus';
    const queries   = this.getTypes(contextName, view, 'queries');
    const replies   = this.getTypes(contextName, view, 'replies');
    return new QueryBus({ ...props, transport, view, queries, replies });
  }

  protected getEventBus(props: any, contextName: string, stream: string) {
    const transport = props.transport || './bus/MySQL_Redis.EventBus';
    const events    = this.getTypes(contextName, stream, 'events');
    return new EventBus({ ...props, transport, stream, events });
  }

  protected getStateBus(props: any, contextName: string, type: string) {
    const transport = props.transport || './bus/MySQL.StateBus';
    const states    = this.getTypes(contextName, type, 'state');
    const state     = states && states[type] || null;
    return new StateBus({ ...props, transport, state });
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
