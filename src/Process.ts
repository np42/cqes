import * as Element                from './Element';
import { Component }               from './Component';
import { Bus }                     from './Bus';
import { Logger }                  from './Logger';

import { merge }                   from './merge';
import { walk }                    from './walk';

import { hostname, userInfo }      from 'os';
import { readFile }                from 'fs';
import * as fs                     from 'fs';
import { join, dirname, basename } from 'path';

const yaml                         = require('js-yaml');

export interface props extends Element.props {
  root:    string;
  config?: string;
  name:    string;
}

interface Contexts { [context: string]: Context }
interface Context  { bus: any; logger: any; [name: string]: Module; }
interface Module   { [service: string]: Component }

export class Process extends Element.Element {
  protected name:        string;
  protected rootpath:    string;
  protected environment: string;
  protected hostname:    string;
  protected procuser:    string;
  protected launcher:    string;
  protected contexts:    Contexts;

  static safeRequire(path: string) {
    try {
      const module = require(path);
      return module;
    } catch (e) {
      if (e.code != 'MODULE_NOT_FOUND') throw e;
      if (!~e.toString().indexOf(path)) throw e;
      return null;
    }
  }

  constructor(props: props) {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
    super({ ...props, logger: new Logger('Process') });
    this.name     = props.name;
    this.rootpath = props.root;
    this.contexts = {};
    this.loadConstant();
  }

  private loadConstant() {
    const environmentsAliases = { dev: 'development', prod: 'production' };
    const environRaw  = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown').toLowerCase();
    const environ     = environmentsAliases[environRaw] || environRaw;
    if (environ == 'unknown')
      this.logger.warn('Unknown environment type (e.g. developement, staging, production)');
    process.env.NODE_ENV = environ;
    this.hostname    = hostname();
    this.procuser    = userInfo().username;
    this.launcher    = process.stdin.isTTY ? 'console' : 'daemon';
    this.environment = environ;
  }

  private readYaml(filepath: string) {
    return new Promise((resolve, reject) => {
      return readFile(filepath, (err, content) => {
        if (err) return resolve({});
        this.logger.log('Loading config file: %s', filepath);
        try {
          const config = yaml.safeLoad(content.toString());
          return resolve(config);
        } catch (e) {
          this.logger.error('Failed when loading:', filepath);
          this.logger.error(e);
          return resolve({});
        }
      });
    });
  }

  private async loadContexts(): Promise<void> {
    const filename  = 'cqes.yml';
    const directory = this.rootpath;
    const filepath  = join(directory, filename);
    const processes = await this.readYaml(filepath);
    this.contexts   = processes[this.name] || {};
    for (const name in this.contexts) {
      const context = this.contexts[name]
      if (!(name in context)) context[name] = {};
    }
  }

  private async loadModules(): Promise<void> {
    for (const contextName in this.contexts) {
      const context   = this.contexts[contextName];
      const directory = join(this.rootpath, contextName);
      const props     = await this.getProps(directory, contextName) || {};
      debugger;
      context.logger = new Logger(contextName);
      const busProps = { context: contextName, logger: context.logger, ...props.bus };
      context.bus    = new Bus(busProps);
      for (const key in props) {
        if (!/^[A-Z]/.test(key)) continue ;
        if (!(key in context)) context[key] = {};
      }
      for (const moduleName in context) {
        if (/^[A-Z]/.test(moduleName)) {
          const directory    = join(this.rootpath, contextName, moduleName);
          const mergedProps  = merge(context[moduleName], props[moduleName]);
          const moduleProps = { context: contextName, module: moduleName, directory
                              , bus: context.bus, logger: context.logger
                              , ...mergedProps };
          context[moduleName] = this.getModule(moduleProps);
        } else {
          this.logger.warn('[%s] Skip module %s', contextName, moduleName);
        }
      }
    }
  }

  private async getProps(directory: string, name: string): Promise<any> {
    const files = this.getPropsFileList();
    let config = <any>{};
    for (const file of files) {
      const filepath = join(directory, file);
      const layer = await this.readYaml(filepath);
      config = merge(config, layer);
    }
    const result = <any>{};
    Object.keys(config).forEach(key => {
      if (~key.indexOf('/')) {
        const offset = key.indexOf('/');
        const module = key.substr(0, offset);
        const component = key.substr(offset + 1);
        if (!(module in result)) result[module] = {};
        result[module][component] = config[key];
      } else {
        result[key] = config[key];
      }
    });
    return result;
  }

  private  getPropsFileList(): Array<string> {
    const extension = '.yml';
    const list = ['context' + extension];
    list.push('context.env-' + this.environment + extension);
    list.push('context.host-' + this.hostname + extension);
    list.push('context.user-' + this.procuser + extension);
    list.push('context.mode-' + this.launcher + extension);
    return list;
  }

  private getModule(props: any) {
    const directory   = props.directory;
    const contextName = props.context;
    const moduleName  = props.module;
    const services =
      { CommandHandler: ['commands', 'events', props.module]
      , Factory:        ['events', props.module]
      , Gateway:        ['events', props.module]
      , Repository:     ['events', 'queries', 'replies', props.module]
      };
    for (const key in props) {
      if (!/^(CommandHandler|Repository|Factory|Gateway)\./.test(key)) continue ;
      const type = key.substr(0, key.indexOf('.'));
      services[key] = services[type];
    }
    // Prepare module services constructors
    const module = {};
    for (const serviceFullName in services) {
      // Retrieve service constructor
      const path = join(directory, serviceFullName);
      const Service = Process.safeRequire(path);
      if (Service == null) continue ;
      const logger = new Logger(contextName+'.'+moduleName+'.'+serviceFullName, 'yellow');
      const serviceType = /^([^.]+)(?:\.|$)/.exec(serviceFullName)[1];
      const serviceName = ~serviceFullName.indexOf('.') ? /\.(.+)$/.exec(serviceFullName)[1] : moduleName;
      const className = serviceName + serviceType;
      if (!(className in Service)) {
        this.logger.warn('%s.%s Missing class %s in service found', contextName, moduleName, className);
        continue ;
      }
      // Instanciate dependencies
      const serviceProps   = { context: contextName, module: moduleName, service: serviceFullName
                             , bus: props.bus, logger
                             };
      debugger;
      const moduleProps    = walk(props[serviceFullName], (key, value) => {
        if (value instanceof Object && '$' in value) {
          if (!/^[a-z]/.test(key)) logger.warn('should have dependency "%s" in lowercase', key);
          const dependencyPath = value.$;
          const dependencyProps = { ...serviceProps, ...value };
          if (/^[A-Z][^\/]*\/[A-Z][^\/]*$/.test(key)) {
            // Import local shared module interface
            const className = /([^\/]+)$/.exec(key)[1] + 'Index';
            const path = join(this.rootpath, dependencyPath);
            const dependency = Process.safeRequire(path);
            if (dependency == null || !(className in dependency)) {
              logger.warn('Missing dependency %s', key);
            } else {
              return new dependency[className](dependencyProps);
            }
          } else {
            // Import cqes module
            const dependency = Process.safeRequire(dependencyPath);
            if (dependency == null || !('default' in dependency)) {
              logger.warn('Missing dependency %s', key);
            } else {
              return new dependency.default(dependencyProps);
            }
          }
        } else {
          return value;
        }
      });
      debugger;
      // Prepare shared data interface
      services[serviceFullName].forEach((resourceName: string) => {
        const path = join(directory, resourceName);
        serviceProps[resourceName] = Process.safeRequire(path);
      })
      const Constructor = Service[className];
      const makeService = instances => {
        const instance = new Constructor(serviceProps);
        debugger;
        for (const dependecyName in dependencies)
          instance[dependecyName] = dependencies[dependecyName];
      };
      module[serviceFullName] = makeService;
    }
    // Instanciate services
    const instances = {};
    const order = ['Factory', 'CommandHandler', 'Repository', 'Gateway'].concat(Object.keys(module));
    Array.from(new Set(order)).forEach(name => {
      if (!(name in module)) return ;
      instances[name] = module[name](instances);
    });
    return instances;
  }

  /*******************************************/

  public async run() {
    await this.loadContexts();
    await this.loadModules();
    return this.start();
  }

  public async start() {
    this.logger.log('%yellow', '==========  Starting  Services  ==========');
    const promises = <Array<Promise<string>>>[];
    for (const contextName in this.contexts) {
      const context = this.contexts[contextName];
      for (const moduleName in context) {
        const module = context[moduleName];
        this.logger.log('Starting %s.%s', contextName, moduleName);
        await module.start();
      }
      await context.bus.start();
    }
    this.logger.log('%green',  '========== All Services started ==========');
    return true;
  }

  public async stop() {
    for (const contextName in this.contexts) {
      const context = this.contexts[contextName];
      await context.bus.stop();
      for (const moduleName in context) {
        const module = context[moduleName];
        this.logger.log('Stoping %s.%s', contextName, moduleName);
        await module.stop();
      }
    }
    this.logger.log('%red',    '==========   Services stopped   ==========');
  }

};
