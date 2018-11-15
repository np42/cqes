import { hostname }   from 'os';
import { readFile }   from 'fs';
import { join }       from 'path';

import { Logger }     from './Logger';
import { Service }    from './Service';
import { Aggregator } from './Aggregator';
import { Gateway }    from './Gateway';

const yaml       = require('js-yaml');
const extendify  = require('extendify');
const CLArgs     = require('command-line-args');

const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });

const defaultService = { mode: 'typescript', name: 'World' };

export class Process {

  private config:       any;
  private argv:         any;
  private logger:       Logger;
  private services:     Map<string, any>;

  public  rootpath:     string;
  public  environment:  string;
  public  hostname:     string;
  public  launcher:     string;

  constructor() {
    this.argv         = CLArgs( [ { name: 'root', type: String }
                                , { name: 'group', type: String, defaultOption: true }
                                ]
                              , { partial: true }
                              );
    this.rootpath     = this.argv.root || process.cwd();
    this.logger       = new Logger(this.argv.group || 'Process');
    this.services     = new Map();
    this.loadConstant();
    process.on('uncaughtException', (error: any) => this.logger.error('exception', error.stack || error));
    process.on('unhandledRejection', (error: any) => this.logger.error('reject', error.stack || error));
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

  private  getConfigFileList(): Array<string> {
    const list = ['config.yml'];
    list.push('config-env-' + this.environment + '.yml');
    list.push('config-host-' + this.hostname + '.yml');
    list.push('config-mode-' + this.launcher + '.yml');
    return list;
  }

  private async getConfig(directory: string): Promise<any> {
    const files = this.getConfigFileList();
    let config = {};
    for (const file of files) {
      const filepath = join(directory, file);
      const part = await (async () => new Promise((resolve, reject) => {
        return readFile(filepath, (err, content) => {
          if (err) return resolve({});
          try {
            const config = yaml.safeLoad(content.toString());
            return resolve(config);
          } catch (e) {
            this.logger.error('Failed when loading:', filepath);
            this.logger.error(e);
            return resolve({});
          }
        });
      }))();
      config = extend(config, part);
    }
    return config;
  }

  private async loadConfig(): Promise<void> {
    const directory = join(this.rootpath, 'cfg');
    this.config = await this.getConfig(directory) || {};
  }

  private async loadServices() {
    if (this.config.Process == null)
      return this.logger.log('No .Process property');
    const process = this.config.Process;
    if (process[this.argv.group] == null)
      return this.logger.log('Process group "%s" not found', this.argv.group);
    const group = process[this.argv.group];
    if (group.services == null)
      return this.logger.log('No service for "%s" to load', this.argv.group);
    for (let i = 0; i < group.services.length; i += 1) {
      const config = extend(defaultService, group.services[i], this.config.Service);
      const name = config.name;
      this.logger.log('Loading Custom Service: %s', name);
      switch (config.mode) {
      case 'typescript': {
        const service = this.createTypescriptService(config);
        this.services.set(name, service);
      } break ;
      case 'reason': {
        const service = this.createReasonService(config);
        this.services.set(name, service);
      }
      }
    }
  }

  private createTypescriptService(config: any) {
    this.logger.error('TODO Typescript service construction');
    process.exit();
  }

  private createReasonService(config: any) {
    const name = config.name;
    const path = (t: string) => join(this.rootpath, config.rootpath, name, name + '_' + t + '.bs.js');

    const Command = safeRequire(path('Command'));
    const Query   = safeRequire(path('Query'));
    const Event   = safeRequire(path('Event'));
    const State   = safeRequire(path('State'));
    const typers  = extend(config, { typers: { Command, Query, Event, State } });

    switch (config.type) {
    case 'Aggregator': {
      const Filter        = safeRequire(path('Filter'));
      const Manager       = safeRequire(path('Manager'));
      const Factory       = safeRequire(path('Factory'));
      const Repository    = safeRequire(path('Repository'));
      const Reactor       = safeRequire(path('Reactor'));
      Manager.handlers    = objectFilter(Manager,    k => /^on([A-Z]|$)/.test(k));
      Factory.handlers    = objectFilter(Factory,    k => /^on([A-Z]|$)/.test(k));
      Repository.handlers = objectFilter(Repository, k => /^query([A-Z]|$)/.test(k));
      Reactor.handlers    = objectFilter(Reactor,    k => /^on([A-Z]|$)/.test(k));
      const facets        = extend(config, { Filter, Manager, Factory, Repository, Reactor });
      const aggregator    = new Aggregator(facets);
      const service       = new Service(typers, aggregator);
      return service;
    }
    case 'Gateway': {
      return null;
    }
    }
  }

  /*******************************************/

  public async run() {
    await this.loadConfig();
    await this.loadServices();
    await this.start();
  }

  public async start() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      service.start(this.config.Broker, options);
    }
  }

};

const safeRequire = (path: string) => {
  try {
    return require(path);
  } catch (e) {
    console.log('|---------------->', e);
    return {};
  }
}

const objectFilter = (obj: any, test: (key: string) => boolean) => {
  const result = {};
  for (const key in obj)
    if (test(key))
      result[key] = obj[key];
  return result;
}
