import * as Component    from './Component';

import { Bus }           from './Bus';
import { Service }       from './Service';
import { Aggregator }    from './Aggregator';
import { Gateway }       from './Gateway';

import { hostname }      from 'os';
import { readFile }      from 'fs';
import { join, dirname } from 'path';
import * as merge        from 'deepmerge';

const yaml       = require('js-yaml');
const CLArgs     = require('command-line-args');

const MERGE_OPTIONS   = { arrayMerge: (l: any, r: any, o: any) => r };
const SERVICE_DEFAULT = { name: 'World', bus: 'default', rootpath: 'dist' };
const AMQP_DEFAULT    = 'amqp://guest:guest@localhost/';

export class Process extends Component.Component {
  protected config:      any;
  protected rootpath:    string;
  protected environment: string;
  protected hostname:    string;
  protected launcher:    string;
  public    services:    Map<string, Service>;

  constructor() {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
    const props     = CLArgs( [ { name: 'root', type: String }
                            , { name: 'groups', type: String, multiple: true, defaultOption: true }
                            , { name: 'dryRun', type: Boolean, defaultOption: false }
                            ]
                          , { partial: true }
                          );
    super({ type: 'Process', ...props }, {});
    this.rootpath = props.root || process.cwd();
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
      return this.logger.log('%s No .Process property', group);
    const processMap = this.config.Process;
    const process = processMap[group];
    if (process == null)
      return this.logger.log('Process group "%s" not found', group);
    for (const name in process) {
      const serviceConfig = process[name];
      const serviceName = serviceConfig.service || name;
      const project = this.config.Project || {};
      const serviceTemplate = this.config.Service[serviceName];
      const config = <any>merge.all( [SERVICE_DEFAULT, project, serviceTemplate, serviceConfig]
                                   , MERGE_OPTIONS
                                   );
      const configBus = this.getBusConfig(this.config.Bus);
      config.name    = name;
      config.service = serviceName;
      config.Bus     = configBus[config.bus] || configBus.default;
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

  private getBusConfig(config: any) {
    if (config == null)
      return { default: { Command: AMQP_DEFAULT, Query: AMQP_DEFAULT } };
    else if (typeof config.default === 'string')
      return { default: { Command: config.default, Query: config.default } };
    if (config.default == null)
      config.default = { Command: AMQP_DEFAULT, Query: AMQP_DEFAULT };
    return config;
  }

  private createService(group: string, options: any) {
    const name = options.service;
    const load = (part: string) => {
      const path = join(this.rootpath, options.rootpath, name, name + '_' + part + '.js');
      return this.safeRequire(group, path, part);
    };
    const props     = { name, type: 'Service', bus: this.bus, ...options };
    const Service   = load('Service');
    const Debouncer = load('Debouncer');
    const Throttler = load('Throttler');
    switch (options.type) {
    case 'Aggregator': {
      const Aggregator = load('Aggregator');
      const Manager    = load('Manager');
      const Factory    = load('Factory');
      const Repository = load('Repository');
      const Buffer     = load('Buffer');
      const Responder  = load('Responder');
      const Reactor    = load('Reactor');
      const children   = { Debouncer, Throttler, Handler: Aggregator
                         , Manager, Factory, Repository, Buffer, Responder, Reactor
                         };
      const service    = new Service(props, children);
      return service;
    }
    case 'Gateway': {
      const gateway  = load('Gateway');
      const children = { Debouncer, Throttler, Handler: Gateway };
      const service  = new Service(props, children);
      return service;
    }
    }
  }

  private safeRequire(group: string, path: string, name: string) {
    try {
      const module = require(path);
      delete require.cache[path];
      this.logger.log('%s %green: %s', group, 'loading', path);
      if (module[name] != null) return module[name];
      if (module.default != null) return module.default;
      return module;
    } catch (e) {
      if (e.code != 'MODULE_NOT_FOUND') throw e;
      if (!~e.toString().indexOf(path)) throw e;
      //this.logger.log('%s %red: %s', group, 'fail', path, e);
      return {};
    }
  }

  /*******************************************/

  public async run() {
    await this.loadConfig();
    this.bus = new Bus(this.config.Bus);
    for (const group of this.props.argv.groups)
      await this.loadGroup(group);
    return this.start();
  }

  public async start() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      service.start();
    }
    await this.bus.start();
  }

  public async stop() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      service.stop();
    }
    await this.bus.stop();
  }

};
