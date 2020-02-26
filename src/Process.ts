import * as Component              from './Component';
import * as Context                from './Context';

import { CommandBus }              from './CommandBus';
import { QueryBus }                from './QueryBus';
import { EventBus }                from './EventBus';
import { StateBus }                from './StateBus';

import * as Manager                from './Manager';
import * as Repository             from './Repository';
import * as View                   from './View';
import * as Trigger                from './Trigger';
import * as Service                from './Service';

import { clone, merge, Tree, get, set
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
  argv?:   Array<string>;
}

interface RecordMap<T = any> { [name: string]: T; };
interface BusEndpoint { name: string, slot: string };
type SlotConfig = string
  | { path:      string;
      context?:  Context.Context;
      slot?:     string;
      as?:       string;
      props?:    any;
    };

export class Process extends Component.Component {
  protected root:          string;
  protected configFile:    string;
  protected vars:          Map<string, string>;
  protected contextsProps: Map<string, Context.ContextProps>;
  protected contexts:      Map<string, Context.Context>;
  readonly  argv:          Array<string>;

  static async readYaml(filepath: string) {
    const content = await new Promise((resolve, reject) => {
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
    return Process.inflateConfig(content);
  }

  static inflateConfig(data: any, root?: any) {
    if (root == null) root = data;
    return Tree.replace(data, (holder, key) => {
      if (!(holder instanceof Object)) return holder;
      if (holder instanceof Array) return holder;
      const result = {};
      for (const key in holder) {
        if (key.substr(0, 2) === '&:') {
          const lastOffset = key.lastIndexOf(':');
          const target     = key.substr(lastOffset + 1);
          const skip       = lastOffset === 1 ? 1 : Number(target);
          const source     = key.substring(2, lastOffset > 1 ? lastOffset : key.length);
          const value      = merge(get(root, source), Process.inflateConfig(holder[key], root));
          const output     = isNaN(skip) ? target : source.split('.').slice(skip).join('.');
          set(result, output, value);
        } else {
          result[key] = holder[key];
        }
      }
      return result;
    });
  }

  constructor(props: props) {
    if (props.name == null) throw new Error('Need a <name> to start');
    super({ name: props.name, logger: 'Process:' + props.name });
    this.root          = props.root || process.cwd();
    this.configFile    = join(this.root, props.config || 'cqesconfig.yml');
    this.argv          = props.argv || [];
    this.vars          = new Map();
    this.contextsProps = new Map();
    this.contexts      = new Map();
    this.loadConstants();
  }

  protected loadConstants() {
    const environmentsAliases = { dev: 'development', prod: 'production' };
    const environRaw  = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown').toLowerCase();
    const environ     = environmentsAliases[environRaw] || environRaw;
    if (environ == 'unknown')
      this.logger.warn('Unknown environment type (e.g. developement, staging, production)');
    if (environ !== 'production')
      Error.stackTraceLimit = Infinity;
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
    //console.log(JSON.stringify(configFileContent[this.name], null, 2));
    const contexts = configFileContent[this.name] || {};
    for (const contextName in contexts) {
      this.logger.log('%magenta %cyan found', 'Context', contextName);
      const props: Context.ContextProps = contexts[contextName] || {};
      props.name = contextName;
      this.setDefaultContextHandlersProps(props);
      this.contextsProps.set(contextName, props);
    }
  }

  protected setDefaultContextHandlersProps(props: Context.ContextProps) {
    if (props.managers == null) props.managers = {};
    if (props.views == null)    props.views    = {};
    if (props.services == null) props.services = {};
    if (props.triggers == null) props.triggers = {};
  }

  protected loadContexts() {
    for (const [contextName, contextProps] of this.contextsProps) {
      const context       = new Context.Context(contextProps);
      this.contexts.set(contextName, context);
      context.views    = this.getContextViews(contextProps, contextProps.views);
      context.managers = this.getContextManagers(contextProps, contextProps.managers);
      context.triggers = this.getContextTriggers(contextProps, contextProps.triggers);
      context.services = this.getContextServices(contextProps, contextProps.services);
    }
  }

  protected getContextManagers(context: Context.ContextProps, managersProps: RecordMap) {
    return Object.keys(managersProps).reduce((result: Map<string, Manager.Manager>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip manager %s', name.substr(1)), result;
      const managerProps        = managersProps[name];
      if (managerProps.listen == null) managerProps.listen = [name];
      const commonProps         = { context: context.name, name, process: this };
      const queryBuses          = this.getQueryBuses(context.name, name, managerProps.views);
      const eventBusProps       = { ...commonProps, ...context.EventBus, ...managerProps.EventBus };
      const eventBus            = this.getEventBus(eventBusProps, context.name, name);
      const stateBusProps       = { ...commonProps, ...context.StateBus, ...managerProps.StateBus };
      const stateBus            = this.getStateBus(stateBusProps, context.name, name);
      const { domainHandlers }  = this.getDomainHandlers(context.name, name, managerProps.repository);
      const repositoryProps     = { stateBus, eventBus, domainHandlers };
      const repository          = new Repository.Repository({ ...commonProps, ...repositoryProps });
      const cHandlersProps      = { ...commonProps, queryBuses, ...managerProps };
      const { commandHandlers } = this.getCommandHandlers(context.name, name, cHandlersProps);
      const commandBuses        = this.getCommandBuses(context.name, name, managerProps.listen);
      const props               = { ...commonProps, commandBuses, commandHandlers, repository, eventBus };
      const manager             = new Manager.Manager(props);
      this.logger.log('%red %cyan.%cyan found', 'Manager', context.name, name);
      result.set(name, manager);
      return result;
    }, new Map());
  }

  protected getContextServices(context: Context.ContextProps, servicesProps: RecordMap) {
    return Object.keys(servicesProps).reduce((result: Map<string, Service.Service>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip service %s', name.substr(1)), result;
      const path               = join(this.root, context.name, name + '.Service');
      const Package            = require(path);
      if (Package == null) throw new Error('Missing ' + name + ' in ' + path);
      if (!('Service' in Package)) Package.Service = Service;
      const serviceProps       = servicesProps[name];
      if (serviceProps.targets == null)    serviceProps.targets    = [];
      if (serviceProps.views == null)      serviceProps.views      = [];
      if (serviceProps.psubscribe == null) serviceProps.psubscribe = [];
      if (serviceProps.streams == null)    serviceProps.streams    = [];
      const commonProps        = { context: context.name, name, process: this };
      const commandBuses       = this.getCommandBuses(context.name, name, serviceProps.targets);
      const queryBuses         = this.getQueryBuses(context.name, name, serviceProps.views);
      const eventBuses1        = this.getEventBuses(context.name, name, serviceProps.psubscribe);
      const eventBuses2        = this.getEventBuses(context.name, name, serviceProps.streams);
      const eventBuses         = { ...eventBuses1, ...eventBuses2 };
      const subscriptions      = Object.keys(eventBuses1);
      const eventBusProps      = { ...commonProps, ...context.EventBus, ...serviceProps.EventBus };
      const eventBus           = this.getEventBus(eventBusProps, context.name, name);
      const repositories       = this.getRepositories(context.name, name, serviceProps.repositories);
      const eHandlersProps     = { queryBuses, repositories };
      const { eventHandlers }  = new Package.EventHandlers({ ...commonProps, ...eHandlersProps, ...serviceProps });
      const buses              = { eventBuses, commandBuses, queryBuses };
      const props              = { ...commonProps, ...serviceProps, buses, subscriptions, eventHandlers };
      const service            = new Package.Service(props);
      eventHandlers.service    = service;
      if (!(service instanceof Service.Service))
        throw new Error('Service ' + name + ' must be type of Service');
      this.logger.log('%yellow %cyan.%cyan found', 'Service', context.name, name);
      result.set(name, service);
      return result;
    }, new Map());
  }

  protected getContextViews(context: Context.ContextProps, viewsProps: RecordMap) {
    return Object.keys(viewsProps).reduce((result: Map<string, View.View>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip view %s', name.substr(1)), result;
      const viewProps          = viewsProps[name];
      if (viewProps.psubscribe == null)   viewProps.psubscribe = [];
      if (viewProps.targets == null)      viewProps.targets = [];
      if (viewProps.repositories == null) viewProps.repositories = [];
      const commonProps        = { context: context.name, name, process: this };
      const eventBuses         = this.getEventBuses(context.name, name, viewProps.psubscribe);
      const queryBusProps      = { ...commonProps, ...context.QueryBus, ...viewProps.QueryBus };
      const queryBus           = this.getQueryBus({ ...queryBusProps, mode: 'server' }, context.name, name);
      const repositories       = this.getRepositories(context.name, name, viewProps.repositories);
      const commandBuses       = this.getCommandBuses(context.name, name, viewProps.targets);
      const queryBuses         = this.getQueryBuses(context.name, name, viewProps.views);
      const handlersDeps       = { queryBuses, commandBuses, repositories };
      const handlersProps      = { ...commonProps, ...handlersDeps, ...viewProps };
      const { queryHandlers }  = this.getQueryHandlers(context.name, name, handlersProps);
      const { updateHandlers } = this.getUpdateHandlers(context.name, name, handlersProps);
      const props = { ...commonProps, queryBus, eventBuses, queryHandlers, updateHandlers };
      const view  = new View.View(props);
      this.logger.log('%blue %cyan.%cyan found', 'View', context.name, name);
      result.set(name, view);
      return result;
    }, new Map());
  }


  protected getContextTriggers(context: Context.ContextProps, triggersProps: RecordMap) {
    return Object.keys(triggersProps).reduce((result: Map<string, Trigger.Trigger>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip trigger %s', name.substr(1)), result;
      const triggerProps = triggersProps[name];
      if (triggerProps.psubscribe == null || triggerProps.psubscribe.length === 0)
        return this.logger.warn('Skip trigger %s, missing persistent subscription', name), result;
      const commonProps    = { context: context.name, name, process: this };
      const eventBuses     = this.getEventBuses(context.name, name, triggerProps.psubscribe);
      const queryBuses     = this.getQueryBuses(context.name, name, triggerProps.views);
      const commandBuses   = this.getCommandBuses(context.name, name, triggerProps.targets);
      const handlersProps  = { ...commonProps, queryBuses, commandBuses, ...triggerProps };
      const triggerOptions = this.getTriggerHandlers(context.name, name, handlersProps);
      const stateBusProps  = { ...commonProps, ...context.StateBus, ...triggerProps.StateBus };
      const stateBus       = this.getStateBus(stateBusProps, context.name, name);
      const props          = { ...commonProps, eventBuses, stateBus, ...triggerOptions };
      const trigger        = new Trigger.Trigger(props);
      this.logger.log('%magenta %cyan.%cyan found', 'Trigger', context.name, name);
      result.set(name, trigger);
      return result;
    }, new Map());
  }

  // Buses
  protected getCommandBuses(fromContext: string, name: string, targets: Array<string>, extra?: any) {
    if (targets == null) return {};
    return this.getBuses<CommandBus>('CommandBus', fromContext, name, targets, extra);
  }

  protected getQueryBuses(fromContext: string, name: string, views: Array<string>, extra?: any) {
    if (views == null) return {};
    return this.getBuses<QueryBus>('QueryBus', fromContext, name, views, { mode: 'client', ...extra });
  }

  protected getEventBuses(fromContext: string, name: string, streams: Array<string>, extra?: any) {
    if (streams == null) return {};
    return this.getBuses<EventBus>('EventBus', fromContext, name, streams, extra);
  }

  protected getBuses<T>(busType: string, from: string, name: string, slots: Array<SlotConfig>, extra?: any) {
    const result = <RecordMap<T>>{};
    for (let item of slots) {
      if (typeof item === 'string') item = { path: item };
      Object.assign(item, this.getBusPathContext(item.path, from));
      if (item.context == null) throw new Error('Please define how to access ' + item.path + ' : ' + busType);
      const props = { name, context: from, ...extra, ...item.context[busType], ...item.props };
      result[item.as] = <T>this['get' + busType](props, item.context.name, item.slot);
    }
    return result;
  }

  protected getBusPathContext(path: string, defaultContextName: string) {
    const match = /(?:([A-Z][a-zA-Z0-9]*)\.)?([A-Z][a-zA-Z0-9\-]*)(?::([A-Z][a-zA-Z0-9]*))?/.exec(path);
    const name  = match[1] || defaultContextName;
    const slot  = match[2];
    const as    = match[3] || match[2];
    const context = this.contextsProps.get(name);
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
    const parts     = { transport, view, queries, replies };
    if (props.mode == 'client') {
      const contextViews = this.contextsProps.get(contextName).views;
      if (!(view in contextViews)) {
        return new QueryBus({ ...props, ...parts });
      } else {
        const serverProps  = contextViews[view].QueryBus;
        return new QueryBus({ ...props, ...serverProps, ...parts });
      }
    } else {
      return new QueryBus({ ...props, ...parts });
    }
  }

  protected getEventBus(props: any, contextName: string, stream: string) {
    const transport = props.transport || './bus/MySQL_Redis.EventBus';
    const events    = this.getTypes(contextName, stream, 'events');
    return new EventBus({ ...props, transport, stream, events });
  }

  protected getStateBus(props: any, contextName: string, type: string) {
    const transport = props.transport || './bus/MySQL.StateBus';
    const states    = this.getTypes(contextName, type);
    const state     = states && states[type] || null;
    return new StateBus({ ...props, transport, state });
  }

  protected getRepositories(contextName: string, name: string, repositories: Array<string>) {
    const result = {};
    repositories.forEach(name => {
      const config     = this.parseRepository(name);
      const props      = { context: contextName, name, process: this, ...config.props };
      const repository = new Repository.Repository(props);
      result[config.name] = repository;
    });
    return result;
  }

  protected parseRepository(path: string | any) {
    if (typeof path == 'string') {
      const [context, name] = path.split('.');
      return { context, name, props: {} };
    } else {
      throw new Error('Not implemented');
    }
  }

  public getTypes(contextName: string, category: string, kind?: string) {
    const path = join(this.root, contextName, category + (kind ? '.' + kind : ''));
    return safeRequire(path);
  }

  // Handlers
  protected getCommandHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Command');
    const { CommandHandlers } = require(path);
    if (!isConstructor(CommandHandlers))
      throw new Error('Constructor CommandHandlers from ' + path + ' expected');
    const commandHandlers = new CommandHandlers(props);
    return { commandHandlers };
  }

  protected getDomainHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Domain');
    const { DomainHandlers } = require(path);
    if (!isConstructor(DomainHandlers))
      throw new Error('Constructor DomainHandlers from ' + path + ' expected');
    const domainHandlers  = new DomainHandlers(props);
    return { domainHandlers };
  }

  protected getQueryHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Query');
    const { QueryHandlers } = require(path);
    if (!isConstructor(QueryHandlers))
      throw new Error('Constructor QueryHandlers from ' + path + ' expected');
    const queryHandlers  = new QueryHandlers(props);
    return { queryHandlers };
  }

  protected getUpdateHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Update');
    const { UpdateHandlers } = require(path);
    if (!isConstructor(UpdateHandlers))
      throw new Error('Constructor UpdateHandlers from ' + path + ' expected');
    const updateHandlers = new UpdateHandlers(props);
    return { updateHandlers };
  }

  protected getTriggerHandlers(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.Trigger');
    const { TriggerHandlers, partition } = require(path);
    if (!isConstructor(TriggerHandlers))
      throw new Error('Constructor TriggerHandlers from ' + path + ' expected');
    const triggerHandlers = new TriggerHandlers(props);
    return { triggerHandlers, partition };
  }

  protected startComponents(): Promise<void> {
    const promises = <Array<Promise<void>>>[];
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, manager] of context.managers) promises.push(manager.start());
      for (const [name, view] of context.views) promises.push(view.start());
      for (const [name, trigger] of context.triggers) promises.push(trigger.start());
      for (const [name, service] of context.services) promises.push(service.start());
    }
    return <any> Promise.all(promises);
  }

  protected catchErrors() {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
  }

  public async stop() {
    const promises = <Array<Promise<void>>>[];
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, manager] of context.managers) promises.push(manager.stop());
      for (const [name, view] of context.views) promises.push(view.stop());
      for (const [name, trigger] of context.triggers) promises.push(trigger.stop());
      for (const [name, service] of context.services) promises.push(service.stop());
    }
    return <any> Promise.all(promises);
  }

};
