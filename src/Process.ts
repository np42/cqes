import * as Element                from './Element';
import { Component }               from './Component';
import { Bus }                     from './Bus';
import { Logger }                  from './Logger';

import { clone }                   from './clone';
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
interface Context  { bus?: Bus; logger?: Logger; modules?: { [name: string]: Module; } }
interface Module   { [service: string]: Component }
interface Dependency { service: string
                     , local?: boolean
                     , resources: Array<string>
                     , dependencies?: { [name: string]: Dependency }
                     }

const LOG_FORMAT = '%cyan.%magenta.%yellow';

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
      const context = this.contexts[name];
      if (!('modules' in context)) context.modules = {};
      if (!(name in context.modules)) context.modules[name] = {};
    }
  }

  private async loadModules(): Promise<void> {
    for (const contextName in this.contexts) {
      const context   = this.contexts[contextName];
      const directory = join(this.rootpath, contextName);
      const props     = await this.getProps(directory, contextName) || {};
      context.logger  = new Logger('%yellow', contextName);
      const busProps  = { context: contextName, logger: context.logger };
      Object.assign(busProps, this.getPropsDependencies(props.bus, busProps));
      context.bus     = new Bus(busProps);
      for (const key in props) {
        if (!/^[A-Z]/.test(key)) continue ;
        if (!(key in context.modules)) context.modules[key] = {};
      }
      for (const moduleName in context.modules) {
        if (/^[A-Z]/.test(moduleName)) {
          const directory    = join(this.rootpath, contextName, moduleName);
          const mergedProps  = merge(context.modules[moduleName], props[moduleName]);
          const moduleProps = { context: contextName, module: moduleName, directory
                              , bus: context.bus, logger: context.logger
                              , ...mergedProps };
          context.modules[moduleName] = this.getModule(moduleProps);
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

  private getPropsFileList(): Array<string> {
    const extension = '.yml';
    const list = ['context' + extension];
    list.push('context.env-' + this.environment + extension);
    list.push('context.host-' + this.hostname + extension);
    list.push('context.user-' + this.procuser + extension);
    list.push('context.mode-' + this.launcher + extension);
    return list;
  }

  private getPropsDependencies(props: any, commonProps: any) {
    const logger = commonProps.logger;
    return walk(props || {}, (key, value) => {
      if (value instanceof Object && '$' in value) {
        if (!/(^[a-z])|\//.test(key)) logger.warn('should have dependency "%s" in lowercase', key);
        const dependencyPath = value.$;
        const dependencyProps = { ...commonProps, ...value };
        if (/^[A-Z][^\/]*\/[A-Z][^\/]*$/.test(dependencyPath)) {
          // Import local shared module interface
          const [_, depContextName, depModuleName] = /^([^\/]*)\/(.*)$/.exec(dependencyPath);
          const className = depModuleName + 'Index';
          const path = join(this.rootpath, dependencyPath);
          const dependency = Process.safeRequire(path);
          if (dependency == null || !(className in dependency)) {
            logger.warn('Missing dependency %s', key);
          } else {
            ['commands', 'queries', 'replies'].forEach(ifaceName => {
              const path  = join(this.rootpath, dependencyPath, ifaceName);
              const iface = Process.safeRequire(path);
              if (iface == null) return ;
              dependencyProps[ifaceName] = iface;
            });
            dependencyProps.name = depContextName + '.' + depModuleName;
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
  }

  private getModule(props: any) {
    const directory   = props.directory;
    const contextName = props.context;
    const moduleName  = props.module;
    const services: { [service: string]: Dependency } =
      { commandHandler:
        { service: 'CommandHandler'
        , resources: ['commands', 'events']
        , dependencies:
          { buffer:
            { service: 'Buffer', local: true
            , resources: ['state']
            , dependencies:
              { factory: { service: 'Factory', resources: ['events'] }
              }
            }
          }
        }
      , gateway:    { service: 'Gateway', resources: ['events'] }
      , repository: { service: 'Repository', resources: ['events', 'queries', 'replies'] }
      };
    for (const key in props) {
      const result = /^(CommandHandler|Repository|Factory|Gateway)\.(.+)/.exec(key);
      if (!result) continue ;
      const [_, type, name] = result;
      const typeName = type[0].toLowerCase() + type.substr(1);
      const service = clone(services[typeName]);
      service.service = key;
      services[name] = service;
    }
    debugger;
    // Prepare module services constructors
    const module = {};
    for (const serviceKey in services) {
      // Retrieve service constructor
      const serviceFullName = services[serviceKey].service;
      const path = join(directory, serviceFullName);
      const Service = Process.safeRequire(path);
      if (Service == null) continue ;
      const serviceType = /^([^.]+)(?:\.|$)/.exec(serviceFullName)[1];
      const serviceName = ~serviceFullName.indexOf('.') ? /\.(.+)$/.exec(serviceFullName)[1] : moduleName;
      const className = serviceName + serviceType;
      if (!(className in Service)) {
        this.logger.warn('%s.%s Missing class %s', moduleName, serviceName, className);
        continue ;
      }
      // Instanciate custom dependencies
      debugger;
      const logger = new Logger(LOG_FORMAT, contextName, moduleName, serviceFullName);
      const serviceProps = { context: contextName, module: moduleName, service: serviceFullName
                           , bus: props.bus, logger
                           };
      Object.assign(serviceProps, this.getPropsDependencies(props[serviceFullName], serviceProps));
      (function loop(service: Dependency, serviceProps: any) {
        // Prepare shared data interface
        service.resources.forEach(resourceName => {
          const path = join(directory, resourceName);
          const iface = Process.safeRequire(path);
          if (iface == null) return ;
          if (resourceName === 'state') {
            serviceProps['state'] = iface[props.module];
          } else {
            serviceProps[resourceName] = iface;
          }
        })
        // Preprare known dependencies
        if (service.dependencies) {
          const knownDependencies = service.dependencies;
          Object.keys(knownDependencies).forEach(fieldName => {
            const dependency = knownDependencies[fieldName];
            const path = dependency.local
              ? './' + dependency.service
              : join(this.rootpath, contextName, moduleName, dependency.service);
            const className = dependency.local
              ? dependency.service
              : moduleName + dependency.service;
            const dependencyPackage = Process.safeRequire(path);
            if (dependencyPackage == null) return ;
            const logger = new Logger(LOG_FORMAT, contextName, moduleName, dependency.service);
            if (!(className in dependencyPackage)) {
              logger.warn('Dependency %s not found', className);
              return ;
            }
            const dependencyProps =
              { context: contextName, module: moduleName, service: dependency.service
              , bus: serviceProps.bus, logger
              };
            loop.call(this, dependency, dependencyProps);
            serviceProps[fieldName] = new dependencyPackage[className](dependencyProps);
          });
        }
      }).call(this, services[serviceKey], serviceProps);
      // Instanciate service
      module[serviceKey] = new Service[className](serviceProps);
    }
    return module;
  }

  /*******************************************/

  public async run() {
    await this.loadContexts();
    await this.loadModules();
    return this.start();
  }

  public async start() {
    this.logger.log('%yellow', '==========  Starting  Services  ==========');
    const promises = [];
    const timeouts = <any>[];
    for (const contextName in this.contexts) {
      const context = this.contexts[contextName];
      for (const moduleName in context.modules) {
        const module = context.modules[moduleName];
        for (const serviceName in module) {
          const service = module[serviceName];
          this.logger.log('Starting ' + LOG_FORMAT, contextName, moduleName, serviceName);
          timeouts.push(setTimeout(() => {
            this.logger.error(LOG_FORMAT + ' won\'t start', contextName, moduleName, serviceName);
            process.exit(-1);
          }, 10000));
          promises.push(service.start());
        }
      }
      await context.bus.start();
    }
    (await Promise.all(promises)).forEach((started, offset) => {
      if (!started) process.exit(-1);
      clearTimeout(timeouts[offset]);
    });
    this.logger.log('%green',  '========== All Services started ==========');
    return true;
  }

  public async stop() {
    for (const contextName in this.contexts) {
      const context = this.contexts[contextName];
      await context.bus.stop();
      for (const moduleName in context.modules) {
        const module = context.modules[moduleName];
        for (const serviceName in module) {
          const service = module[serviceName];
          this.logger.log('Stoping ' + LOG_FORMAT, contextName, moduleName, serviceName);
          await service.stop();
        }
      }
    }
    this.logger.log('%red',    '==========   Services stopped   ==========');
  }

};
