import { hostname } from 'os';
import { readFile } from 'fs';
import { join }     from 'path';

import { Logger }   from './Logger';

const yaml       = require('js-yaml');
const extendify  = require('extendify');
const CLArgs     = require('command-line-args');

enum ActionTypes
{ LoadMainConfig
, SetConfig
, RegisterService
};

type Service = any;

interface Task { type: ActionTypes, payload: any };

export class Process {

  public static nameOf(path: string) {
    try { return path.split('/').pop().replace(/^(.+?)\.[a-z]+$/, '$1'); }
    catch (e) { return 'BhivProcess'; }
  }

  public  name:         string;
  private config:       any;
  private argv:         any;
  private logger:       Logger;
  private loading:      Array<Task>;
  private services:     Map<string, Service>;

  public  rootpath:     string;
  public  environment:  string;
  public  hostname:     string;
  public  launcher:     string;

  constructor() {
    this.name         = Process.nameOf(process.env.pm_exec_path || process.argv[1]);
    this.argv         = CLArgs({ name: 'rootpath' }, { partial: true });
    this.rootpath     = this.argv.rootpath || process.cwd();
    this.logger       = new Logger(this.name);
    this.loading      = [];
    this.services     = new Map();
    this.loadConstant();
    process.on('uncaughtException', (error: any) => this.logger.error('exception', error.stack || error));
    process.on('unhandledRejection', (error: any) => this.logger.error('reject', error.stack || error));
    //--
    this.loading.push({ type: ActionTypes.LoadMainConfig, payload: this.rootpath });
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

  public setConfig(config: any) {
    this.loading.push({ type: ActionTypes.SetConfig, payload: config });
  }

  public registerService(Module: Service) {
    this.loading.push({ type: ActionTypes.RegisterService, payload: Module });
  }

  public async run() {
    while (this.loading.length > 0)
      await this.nextTick();
  }

  private async nextTick(): Promise<void> {
    const task = this.loading.shift();
    switch (task.type) {
    case ActionTypes.LoadMainConfig:         return this.loadMainConfig(task.payload);
    case ActionTypes.SetConfig:              return this.loadCustomConfig(task.payload);
    case ActionTypes.RegisterService:        return this.loadService(task.payload);
    }
  }

  private  getConfigFileList(): Array<string> {
    const list = ['config.yml'];
    list.push('config-env-' + this.environment + '.yml');
    list.push('config-host-' + this.hostname + '.yml');
    list.push('config-mode-' + this.launcher + '.yml');
    return list;
  }

  private async getConfig(directory: string): Promise<any> {
    const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
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

  private async loadMainConfig(rootpath: string): Promise<void> {
    const directory = join(rootpath, 'config');
    this.config = await this.getConfig(directory);
  }

  private async loadCustomConfig(config: any) {
    const extend = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
    this.config = extend(this.config, config);
  }

  public async getModuleConfig(name: string, type: string) {
    const extend       = extendify({ inPlace: false, isDeep: true, arrays: 'replace' });
    const directory    = join(this.rootpath, 'dist', type, name);
    const moduleConfig = await this.getConfig(directory);
    const userConfig   = this.config[name] || {};
    const config       = this.resolve(extend(moduleConfig, userConfig, this.config.$all || {}));
    while ((function resolve(base, node) {
      while ('_' in node) {
        const layer = base[node._] || {};
        delete node._;
        Object.assign(node, layer);
      }
    })(this.config, config));
    return config;
  }

  private resolve(data: any) {
    JSON.stringify(data, function (key, value) {
      if (typeof value == 'string' && value.substr(0, 2) == '_:')
        this[key] = data[key];
      return value;
    });
    return data;
  }

  private async loadService(Module: Service) {
    const config = await this.getModuleConfig(Module.name, 'Service');
    const instance = new Module(config);
    this.services.set(Module.name, instance);
  }

};
