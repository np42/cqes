import * as Component              from './Component';
import * as Context                from './Context';

import { CommandBus }              from './CommandBus';
import { QueryBus }                from './QueryBus';
import { EventBus }                from './EventBus';
import { StateBus }                from './StateBus';

import * as Aggregate              from './Aggregate';
import * as Repository             from './Repository';
import * as View                   from './View';
import * as Trigger                from './Trigger';
import * as Service                from './Service';

import * as TestAggregate          from './TestAggregate';

import * as StateAble              from './StateAble';

import { clone, merge, get, set
       , Content, Digest
       , isConstructor }           from 'cqes-util';

import { hostname, userInfo }      from 'os';
import { join, dirname, basename } from 'path';
import * as yargs                  from 'yargs';


export interface argv {
  _:        Array<string>;
  config?:  string;
  env?:     string;
  dump?:    boolean;
  test?:    boolean;
}

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
  protected contextsProps: Map<string, Context.ContextProps>;
  protected contexts:      Map<string, Context.Context>;
  readonly vars:           Map<string, string>;
  readonly argv:           argv;
  readonly isTestMode:     boolean;

  constructor(props: props) {
    const argv         = <argv>yargs.argv;
    const isTestMode   = argv.test || argv._[0] === 'Test';

    if (isTestMode) super({ context: null, name: argv._[0] || 'Test', process: null });
    else if (argv._.length > 0) super({ context: null, name: argv._[0], process: null });
    else throw new Error('Need a <name> to start');

    this.root          = props.root || process.cwd();
    this.configFile    = join(this.root, argv.config || 'cqesconfig.yml');
    this.argv          = argv;
    this.vars          = new Map();
    this.isTestMode    = isTestMode;
    this.contextsProps = new Map();
    this.contexts      = new Map();
    this.loadConstants();
  }

  protected loadConstants() {
    const env         = process.env;
    const environmentsAliases = { dev: 'development', prod: 'production' };
    const environRaw  = (this.argv.env || env.NODE_ENV || env.ENVIRONMENT || 'unknown').toLowerCase();
    const environ     = (<any>environmentsAliases)[environRaw] || environRaw;
    if (environ !== 'production')
      Error.stackTraceLimit = Infinity;
    process.env.NODE_ENV = environ;
    const profileMatch = /^cqes-(.+)\.ya?ml$/.exec(this.argv.config);
    this.vars.set('profile',  profileMatch ? profileMatch[1] : 'default');
    this.vars.set('hostname', hostname());
    this.vars.set('procuser', userInfo().username);
    this.vars.set('launcher', process.stdin.isTTY ? 'console' : 'daemon');
    this.vars.set('environment', environ);
  }

  public async start() {
    const promises = [];
    const timeouts = <any>[];
    await this.loadConfig();
    if (this.isTestMode) {
      await this.loadTestContexts();
      await this.startComponents();
      await this.runTests();
      await this.stop();
    } else {
      await this.loadContexts();
      await this.startComponents();
      this.catchErrors();
      this.logger.log('%bold', 'Process Ready');
    }
  }

  protected async loadConfig() {
    this.logger.log('%bold %s', 'Load Config file', this.configFile);
    const configFileContent = await Content.getFile(this.configFile);
    if (this.argv.dump) {
      console.log(JSON.stringify(configFileContent[this.name], null, 2));
      process.exit();
    }
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
    if (props.aggregates == null) props.aggregates = {};
    if (props.views == null)      props.views    = {};
    if (props.services == null)   props.services = {};
    if (props.triggers == null)   props.triggers = {};
  }

  protected loadContexts() {
    this.logger.log('%bold', 'Load Contexts');
    for (const [contextName, contextProps] of this.contextsProps) {
      const context      = new Context.Context({ context: contextProps.name, name: 'This', process: this });
      this.contexts.set(contextName, context);
      context.views      = this.getContextViews(contextProps, contextProps.views);
      context.aggregates = this.getContextAggregates(contextProps, contextProps.aggregates);
      context.triggers   = this.getContextTriggers(contextProps, contextProps.triggers);
      context.services   = this.getContextServices(contextProps, contextProps.services);
    }
  }

  protected loadTestContexts() {
    this.logger.log('%bold', 'Load Testing Contexts');
    for (const [contextName, contextProps] of this.contextsProps) {
      const context      = new Context.Context({ context: contextProps.name, name: 'This', process: this });
      this.contexts.set(contextName, context);
      //context.views      = this.getContextViews(contextProps, contextProps.views);
      context.aggregates = this.getTestContextAggregates(contextProps, contextProps.aggregates);
      //context.triggers   = this.getContextTriggers(contextProps, contextProps.triggers);
      //context.services   = this.getContextServices(contextProps, contextProps.services);
    }
  }

  protected getContextAggregates(context: Context.ContextProps, aggregatesProps: RecordMap) {
    return Object.keys(aggregatesProps).reduce((result: Map<string, Aggregate.Aggregate>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip aggregate %s', name.substr(1)), result;
      const aggregateProps      = aggregatesProps[name];
      if (aggregateProps.listen == null) aggregateProps.listen = [name];
      const category            = name;
      const commonProps         = { context: context.name, name, process: this };
      const queryBuses          = this.getQueryBuses(context.name, name, aggregateProps.views);
      const eventBusProps       = { ...commonProps, ...context.EventBus, ...aggregateProps.EventBus };
      const eventBusIn          = this.getEventBus(eventBusProps, context.name, category);
      const eventBusOut         = this.getEventBus(eventBusProps, context.name, category);
      const stateBusProps       = { ...commonProps, ...context.StateBus, ...aggregateProps.StateBus };
      const stateBus            = this.getStateBus(stateBusProps, context.name, name);
      const domainProps         = { ...commonProps, ...aggregateProps.repository };
      const { domainHandlers }  = this.getDomainHandlers(context.name, name, domainProps);
      const repositoryProps     = { stateBus, eventBus: eventBusIn, domainHandlers };
      const repository          = new Repository.Repository({ ...commonProps, category, ...repositoryProps });
      const cHandlersProps      = { ...commonProps, queryBuses, ...aggregateProps };
      const { commandHandlers } = this.getCommandHandlers(context.name, name, cHandlersProps);
      const commandBuses        = this.getCommandBuses(context.name, name, aggregateProps.listen);
      const buses               = { commandBuses, eventBus: eventBusOut }
      const props               = { ...commonProps, commandHandlers, ...buses, repository };
      const aggregate           = new Aggregate.Aggregate(props);
      this.logger.log('%red %cyan.%cyan found', 'Aggregate', context.name, name);
      result.set(name, aggregate);
      return result;
    }, new Map());
  }

  protected getTestContextAggregates(context: Context.ContextProps, aggregatesProps: RecordMap) {
    return Object.keys(aggregatesProps).reduce((result: Map<string, TestAggregate.TestAggregate>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip aggregate %s', name.substr(1)), result;
      const aggregateProps      = aggregatesProps[name];
      if (aggregateProps.listen == null) aggregateProps.listen = [name];
      const commonProps         = { context: context.name, name, process: this };
      const cHandlersProps      = { ...commonProps, ...aggregateProps };
      const commandTesters      = this.getCommandTesters(context.name, name, cHandlersProps);
      if (commandTesters == null) return result;
      const { commandHandlers } = this.getCommandHandlers(context.name, name, cHandlersProps);
      const props               = { ...commonProps, commandHandlers, commandTesters };
      const testAggregate       = new TestAggregate.TestAggregate(props);
      this.logger.log('%red %cyan.%cyan found', 'Test Aggregate', context.name, name);
      result.set(name, testAggregate);
      return result;
    }, new Map());
  }

  protected getContextServices(context: Context.ContextProps, servicesProps: RecordMap) {
    return Object.keys(servicesProps).reduce((result: Map<string, Service.Service>, name: string) => {
      if (/^_/.test(name)) return this.logger.log('Skip service %s', name.substr(1)), result;
      const path            = join(this.root, context.name, name + '.Service');
      const Package         = require(path);
      if (Package == null) throw new Error('Missing ' + name + ' in ' + path);
      const serviceProps    = servicesProps[name];
      if (serviceProps.commands     == null) serviceProps.commands     = [];
      if (serviceProps.views        == null) serviceProps.views        = [];
      if (serviceProps.psubscribe   == null) serviceProps.psubscribe   = [];
      if (serviceProps.subscribe    == null) serviceProps.subscribe    = [];
      if (serviceProps.repositories == null) serviceProps.repositories = [];
      const commonProps     = { context: context.name, name, process: this };
      const commandBuses    = this.getCommandBuses(context.name, name, serviceProps.commands);
      const queryBuses      = this.getQueryBuses(context.name, name, serviceProps.views);
      const eventBuses1     = this.getEventBuses(context.name, name, serviceProps.psubscribe);
      const eventBuses2     = this.getEventBuses(context.name, name, serviceProps.subscribe);
      const eventBuses      = { ...eventBuses1, ...eventBuses2 };
      const psubscriptions  = Object.keys(eventBuses1);
      const subscriptions   = Object.keys(eventBuses2);
      const repoStateBus    = { ...context.StateBus, ...serviceProps.StateBus };
      const repoEventBus    = { ...context.EventBus, ...serviceProps.EventBus };
      const repoProps       = { ...serviceProps, StateBus: repoStateBus, EventBus: repoEventBus };
      const repositories    = this.getRepositories(context.name, name, serviceProps.repositories, repoProps);
      const buses           = { eventBuses, commandBuses, queryBuses };
      const props           = { ...commonProps, ...serviceProps, ...buses, psubscriptions, subscriptions
                              , eventHandlers: null, repositories
                              };
      if ('EventHandlers' in Package) {
        const eventHandlers  = new Package.EventHandlers({ ...commonProps, ...serviceProps });
        props.eventHandlers  = eventHandlers;
      } else {
        props.eventHandlers  = new Service.Event.Handlers({ ...commonProps });
      }
      const service = new Package[name](props);
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
      if (viewProps.psubscribe   == null) viewProps.psubscribe = [];
      if (viewProps.commands     == null) viewProps.commands = [];
      if (viewProps.repositories == null) viewProps.repositories = [];
      const hasQS              = viewProps.noquery === true ? false : true;
      const hasUS              = viewProps.noupdate === true ? false : true;
      const commonProps        = { context: context.name, name, process: this };
      const eventBuses         = hasUS ? this.getEventBuses(context.name, name, viewProps.psubscribe) : {};
      const queryBusProps      = { ...commonProps, ...context.QueryBus, ...viewProps.QueryBus, mode: 'server' };
      const queryBus           = hasQS ? this.getQueryBus(queryBusProps, context.name, name) : null;
      const repoStateBus       = { ...context.StateBus, ...viewProps.StateBus };
      const repoEventBus       = { ...context.EventBus, ...viewProps.EventBus };
      const repoProps          = { ...viewProps, StateBus: repoStateBus, EventBus: repoEventBus };
      const repositories       = this.getRepositories(context.name, name, viewProps.repositories, repoProps);
      const commandBuses       = this.getCommandBuses(context.name, name, viewProps.commands);
      const queryBuses         = this.getQueryBuses(context.name, name, viewProps.views);
      const handlersDeps       = { queryBuses, commandBuses, repositories };
      const handlersProps      = { ...commonProps, ...viewProps, ...handlersDeps };
      const { queryHandlers }  = hasQS ? this.getQueryHandlers(context.name, name, handlersProps) : <any>{};
      const { updateHandlers } = hasUS ? this.getUpdateHandlers(context.name, name, handlersProps) : <any>{};
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
      const commandBuses   = this.getCommandBuses(context.name, name, triggerProps.commands);
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
  protected getCommandBuses(fromContext: string, name: string, commands: Array<string>, extra?: any) {
    if (commands == null) return {};
    return this.getBuses<CommandBus>('CommandBus', fromContext, name, commands, extra);
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
    const commonProps = { context: from, name, process: this };
    for (const item of slots) {
      const config = typeof item === 'string' ? { path: item } : item
      Object.assign(config, this.getBusPathContext(config.path, from));
      if (config.context != null) {
        const props = { ...commonProps, ...extra, ...(<any>config.context)[busType], ...config.props };
        result[config.as] = <T>(<any>this)['get' + busType](props, config.context.name, config.slot);
      } else {
        throw new Error('Please define how to access ' + config.path + ' : ' + busType);
      }
    }
    return result;
  }

  protected getBusPathContext(path: string, defaultContextName: string) {
    const match = /(?:([A-Z][a-zA-Z0-9]*)\.)?([A-Z][a-zA-Z0-9\-]*)(?::([A-Z][a-zA-Z0-9]*))?/.exec(path);
    const name  = match[1] || defaultContextName;
    const slot  = match[2];
    const as    = match[3] || match[2];
    const context = this.contextsProps.get(name) || { name };
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
      const clientContext = this.contextsProps.get(contextName);
      if (clientContext?.views != null && view in clientContext.views) {
        const serverProps  = clientContext.views[view].QueryBus;
        return new QueryBus({ ...props, ...serverProps, ...parts });
      }
    }
    return new QueryBus({ ...props, ...parts });
  }

  protected getEventBus(props: any, contextName: string, category: string) {
    const transport     = props.transport || './bus/MySQL_Redis.EventBus';
    const events        = this.getTypes(contextName, category, 'events');
    const originContext = contextName;
    return new EventBus({ ...props, transport, originContext, category, events });
  }

  protected getStateBus(props: any, contextName: string, type: string) {
    const transport = props.transport || './bus/MySQL.StateBus';
    const states    = this.getTypes(contextName, type);
    const state     = states && states[type] || null;
    return new StateBus({ ...props, transport, state });
  }

  protected getRepositories(contextName: string, name: string, repositories: Array<string>, extra: any) {
    const result = <StateAble.Repositories>{};
    repositories.forEach(path => {
      const commonProps        = { context: contextName, name, process: this };
      const config             = this.parseRepository(path);
      const category           = config.name;
      const handlersProps      = { ...commonProps, ...extra };
      const { domainHandlers, version
            }                  = this.getDomainHandlers(config.context, config.name, handlersProps);
      const remoteProps        = <any>(this.contextsProps.get(config.context) || {});
      const stateBusProps      = { ...commonProps, ...remoteProps.StateBus, version };
      const stateBus           = this.getStateBus(stateBusProps, config.context, config.name);
      const ebProps            = { originContext: config.context, category: config.name };
      const eventBusProps      = { ...commonProps, ...remoteProps.EventBus, ...ebProps };
      const eventBus           = this.getEventBus(eventBusProps, config.context, config.name);
      const deps               = { stateBus, eventBus, domainHandlers };
      const props              = { ...commonProps, category, ...deps, ...config.props, version };
      const repository         = new Repository.Repository(props);
      result[config.name]      = repository;
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
    const { DomainHandlers, version: customVersion } = require(path);
    if (!isConstructor(DomainHandlers))
      throw new Error('Constructor DomainHandlers from ' + path + ' expected');
    const domainHandlers  = new DomainHandlers(props);
    const version         = customVersion || this.getDomainHandlersVersion(domainHandlers);
    this.logger.log('%s.%s Domain for %s has version: %s', contextName, name, domainHandlers.name, version);
    return { domainHandlers, version };
  }

  protected getDomainHandlersVersion(domainHandlers: Repository.Domain.Handlers) {
    const domainDescriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(domainHandlers));
    const digest = new Digest();
    for (const handlerName in domainDescriptors) {
      if (/^[^A-Z]/.test(handlerName)) continue ;
      digest.update(domainDescriptors[handlerName].value);
    }
    return digest.toString();
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

  // Testers
  protected getCommandTesters(contextName: string, name: string, props: any) {
    const path = join(this.root, contextName, name + '.TestCommand');
    const module = safeRequire(path);
    if (!isConstructor(module.CommandTesters)) return null;
    const commandTesters = new module.CommandTesters(props);
    return commandTesters;
  }

  // ------------------

  protected startComponents(): Promise<void> {
    this.logger.log('%bold', 'Start Components');
    const promises = <Array<Promise<void>>>[];
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, aggregate] of context.aggregates) promises.push(this.startComponent(aggregate));
      for (const [name, view]      of context.views)      promises.push(this.startComponent(view));
      for (const [name, trigger]   of context.triggers)   promises.push(this.startComponent(trigger));
      for (const [name, service]   of context.services)   promises.push(this.startComponent(service));
    }
    return <any> Promise.all(promises);
  }

  protected async startComponent(component: Component.Component): Promise<void> {
    await component.start();
    if (component.started !== true)
      this.logger.error('Unable to start %s:%s:%s', component.context, component.name, component.type);
  }

  protected catchErrors() {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
  }

  public async runTests() {
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, aggregate] of context.aggregates) await aggregate.runTests();
      //for (const [name, view]      of context.views)      promises.push(view.stop());
      //for (const [name, trigger]   of context.triggers)   promises.push(trigger.stop());
      //for (const [name, service]   of context.services)   promises.push(service.stop());
    }
  }

  public async stop() {
    const promises = <Array<Promise<void>>>[];
    for (const [contextName, context] of this.contexts) {
      if (!(context instanceof Context.Context)) continue ;
      for (const [name, aggregate] of context.aggregates) promises.push(aggregate.stop());
      for (const [name, view]      of context.views)      promises.push(view.stop());
      for (const [name, trigger]   of context.triggers)   promises.push(trigger.stop());
      for (const [name, service]   of context.services)   promises.push(service.stop());
    }
    return <any> Promise.all(promises);
  }

};
