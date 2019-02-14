import * as Component    from './Component';

import { Service }       from './Service';
import { Logger }        from './Logger';

import { hostname }      from 'os';
import { readFile }      from 'fs';
import { join, dirname } from 'path';
import * as merge        from 'deepmerge';

const yaml       = require('js-yaml');
const CLArgs     = require('command-line-args');

const MERGE_OPTIONS   = { arrayMerge: (l: any, r: any, o: any) => r };
const PROJECT_DEFAULT = { libpath: 'dist', servicepath: '%r/%l/%s/%t.js', servicekey: '%t' };
const SERVICE_DEFAULT = { name: 'World' };
const AMQP_DEFAULT    = 'amqp://guest:guest@localhost/';

export class Process extends Component.Component {
  protected config:      any;
  protected rootpath:    string;
  protected environment: string;
  protected hostname:    string;
  protected launcher:    string;
  protected services:    Map<string, Service>;

  constructor() {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
    const argv = CLArgs( [ { name: 'root', type: String }
                         , { name: 'groups', type: String, multiple: true, defaultOption: true }
                         , { name: 'dryRun', type: Boolean, defaultOption: false }
                         , { name: 'config', type: String, defaultOption: 'config' }
                         ]
                       , { partial: true }
                       );
    super({ name: 'CQES', type: 'Process', argv }, {});
    this.rootpath = argv.root || process.cwd();
    this.services = new Map();
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
    this.launcher    = process.stdin.isTTY ? 'console' : 'daemon';
    this.environment = environ;
  }

  private async loadConfig(): Promise<void> {
    const directory = join(this.rootpath, this.props.argv.config || 'config');
    this.config = await this.getConfig(directory) || {};
    for (const key in this.config.Logger)
      Logger.setOption(key, this.config.Logger[key]);
  }

  private async getConfig(directory: string): Promise<any> {
    const files = this.getConfigFileList();
    let config = {};
    for (const file of files) {
      const filepath = join(directory, file);
      const part = await this.configReadYaml(filepath);
      const layer = await this.configInflate(part, dirname(filepath));
      config = merge(config, layer, MERGE_OPTIONS);
    }
    return config;
  }

  private  getConfigFileList(): Array<string> {
    const list = ['config.yml'];
    list.push('config-env-' + this.environment + '.yml');
    list.push('config-host-' + this.hostname + '.yml');
    list.push('config-mode-' + this.launcher + '.yml');
    return list;
  }

  private async configInflate(object: any, cwd: string): Promise<any> {
    if (object && typeof object == 'object') {
      if (object instanceof Array) {
        const result = [];
        for (const item of object)
          result.push(await this.configInflate(item, cwd));
        return result;
      } else {
        if ('$import' in object) {
          return await this.configImport(object.$import, cwd);
        } else {
          const result = <any>{};
          for (const key in object)
            result[key] = await this.configInflate(object[key], cwd);
          return result;
        }
      }
    } else {
      return object;
    }
  }

  private async configImport(filename: string, cwd: string): Promise<any> {
    const filepath = join(cwd, filename);
    const content = await this.configReadYaml(filepath);
    return this.configInflate(content, dirname(filepath));
  }

  private configReadYaml(filepath: string) {
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

  /******************************/

  private async loadGroup(group: string) {
    if (this.config.Process == null)
      return this.logger.warn('%s No .Process property', group);
    const processMap = this.config.Process;
    const process = processMap[group];
    if (process == null)
      return this.logger.error('Process group "%s" not found', group);
    for (const name in process) {
      const serviceConfig   = process[name];
      const serviceName     = serviceConfig.service || name;
      const project         = merge(PROJECT_DEFAULT, this.config.Project, MERGE_OPTIONS);
      const serviceTemplate = { name, service: serviceName, ...this.config.Service[serviceName] };
      const config = <any>merge.all( [SERVICE_DEFAULT, project, serviceTemplate, serviceConfig]
                                   , MERGE_OPTIONS
                                   );
      this.logger.log('%s Loading Custom Service: %cyan', group, name);
      if (config.type == 'Gateway' || config.type == 'Aggregator') {
        if (!this.props.argv.dryRun) {
          const service = this.createService(group, config);
          this.services.set(name, service);
        }
      } else {
        this.logger.error('%s Bad process type for: %s', group, name);
      }
    }
  }

  private createService(group: string, options: any) {
    const name = options.name;
    const service = options.service;
    const load = (part: string, service: string) => {
      const vars = { r: this.rootpath, l: options.libpath, s: service, n: name, t: part };
      const path = options.servicepath
        .replace(/%([a-z])/g, (_: string, k: string) => vars[k] || '')
        .replace(/\/+/g, '/');
      const key = options.servicekey.replace(/%([a-z])/g, (_: string, k: string) => vars[k] || '');
      const module = this.safeRequire(group, path, part);
      if (module == null) return null;
      const constructor = module[key];
      if (constructor && typeof constructor != 'function') {
        this.logger.warn('%s.%s.%s is not a valid module', group, name, part);
        return null;
      }
      return constructor;
    };
    const props      = <any>merge.all( [ { name, type: 'Service' }, options.Service || {}
                                       , { Bus: this.config.Bus }, options || {} ]
                                     , MERGE_OPTIONS);
    const Bus        = load('Bus', service);
    const Debouncer  = load('Debouncer', service);
    const Throttler  = load('Throttler', service);
    switch (options.type) {
    case 'Aggregator': {
      const Aggregator = load('Aggregator', service);
      const Manager    = load('Manager', service);
      const Factory    = load('Factory', service);
      const Repository = load('Repository', service);
      const Buffer     = load('Buffer', service);
      const Responder  = load('Responder', service);
      const Reactor    = load('Reactor', service);
      const children   = { Bus, Debouncer, Throttler, Aggregator
                         , Manager, Factory, Repository, Buffer, Responder, Reactor
                         };
      return new Service(props, children);
    }
    case 'Gateway': {
      const Gateway  = load('Gateway', service);
      const children = { Bus, Debouncer, Throttler, Gateway };
      return new Service(props, children);
    }
    }
  }

  private safeRequire(group: string, path: string, name: string) {
    try {
      const module = require(path);
      this.logger.log('%s %green: %s', group, 'loading', path);
      return module;
    } catch (e) {
      if (e.code != 'MODULE_NOT_FOUND') throw e;
      if (!~e.toString().indexOf(path)) throw e;
      //this.logger.log('%s %red: %s', group, 'fail', path, e);
      return null;
    }
  }

  /*******************************************/

  public async run() {
    await this.loadConfig();
    for (const group of this.props.argv.groups)
      await this.loadGroup(group);
    this.logger.log('%yellow', '============ Services initialized ============');
    return this.start();
  }

  public async start() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      await service.start();
    }
    this.logger.log('%green', '============ Services started ============');
  }

  public async stop() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      await service.stop();
    }
    this.logger.log('%red', '============ Services stopped ============');
  }

};
