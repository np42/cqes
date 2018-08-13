import { hostname } from 'os';
import { readFile } from 'fs';
import { join }     from 'path';
import * as express from 'express';
import * as http    from 'http';
import * as url     from 'url';

const yaml          = require('js-yaml');
const extendify     = require('extendify');
const CLArgs        = require('command-line-args');

import { Service, IService } from 'bhiv/Service';
import { Repository } from 'bhiv/Repository';

enum ActionTypes
{ LoadMainConfig
, StartHttpServer
, SetConfig
, RegisterService
, RegisterRepository
, RegisterProcessManager
};

interface Task { type: ActionTypes, payload: any };

export default new class Process extends Service {

  public static nameOf(path: string) {
    try { return path.split('/').pop().replace(/^(.+?)\.[a-z]+$/, '$1'); }
    catch (e) { return 'BhivProcess'; }
  }

  private argv:         any;
  private loading:      Array<Task>;
  private app:          express.Express;
  private http:         http.Server;
  private services:     Map<string, Service>;
  private managers:     Map<string, Service>;
  private repositories: Map<string, Repository>;

  public  rootpath:     string;
  public  environment:  string;
  public  hostname:     string;
  public  launcher:     string;

  constructor() {
    super({});
    this.name         = Process.nameOf(process.env.pm_exec_path || process.argv[1]);
    this.argv         = CLArgs({ name: 'rootpath', defaultOption: true }, { partial: true });
    this.rootpath     = this.argv.rootpath || join(__dirname, '../../..');
    this.loading      = [];
    this.services     = new Map();
    this.repositories = new Map();
    this.managers     = new Map();
    this.loadConstant();
    process.on('uncaughtException', error => this.logger.error('exception', error.stack || error));
    process.on('unhandledRejection', error => this.logger.error('reject', error.stack || error));
    //--
    this.loading.push({ type: ActionTypes.LoadMainConfig, payload: this.rootpath });
    this.loading.push({ type: ActionTypes.StartHttpServer, payload: this.name });
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

  private startHttpServer(name: string) {
    const config = (this.config.Process || {})[name] || {};

    this.app = express();
    this.app.use((req, res, next) => {
      if (req.headers['origin'] != null)
        res.header("Access-Control-Allow-Origin", <string>req.headers['origin']);
      if (req.headers['access-control-request-method'] != null)
        res.header('Access-Control-Allow-Methods', <string>req.headers['access-control-request-method']);
      if (req.headers['access-control-request-headers'] != null)
        res.header("Access-Control-Allow-Headers", <string>req.headers['access-control-request-headers']);
      if (req.method == 'OPTIONS') return res.send(204);
      else return next();
    });

    if (config.Http != null) {
      this.http = http.createServer(this.app);
      this.http.listen(config.Http.port, config.Http.ip || '127.0.0.1');
    }
  }

  public setConfig(config: any) {
    this.loading.push({ type: ActionTypes.SetConfig, payload: config });
  }

  public registerService(Module: IService) {
    this.loading.push({ type: ActionTypes.RegisterService, payload: Module });
  }

  public registerRepository(Module: IService) {
    this.loading.push({ type: ActionTypes.RegisterRepository, payload: Module });
  }

  public registerProcessManager(Module: IService) {
    this.loading.push({ type: ActionTypes.RegisterProcessManager, payload: Module });
  }

  public getRepository(name: string) {
    return this.repositories.get(name);
  }

  public getProcessManager(name: string) {
    return this.managers.get(name);
  }

  public async run() {
    while (this.loading.length > 0)
      await this.nextTick();
  }

  private async nextTick(): Promise<void> {
    const task = this.loading.shift();
    switch (task.type) {
    case ActionTypes.LoadMainConfig:         return this.loadMainConfig(task.payload);
    case ActionTypes.StartHttpServer:        return this.startHttpServer(task.payload);
    case ActionTypes.SetConfig:              return this.loadCustomConfig(task.payload);
    case ActionTypes.RegisterService:        return this.loadService(task.payload);
    case ActionTypes.RegisterRepository:     return this.loadRepository(task.payload);
    case ActionTypes.RegisterProcessManager: return this.loadProcessManager(task.payload);
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
      let altered = false;
      while ('_' in node) {
        const layer = base[node._] || {};
        delete node._;
        altered = true;
        Object.assign(node, layer);
      }
      for (const key in node) {
        if (node[key] instanceof Object)
          if (resolve(base, node[key]))
            altered = true;
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

  private async loadRepository(Module: Repository) {
    const config = await this.getModuleConfig(Module.name, 'Repository');
    const instance = new Module(config);
    this.repositories.set(Module.name, instance);
  }

  private async loadProcessManager(Module: Repository) {
    const config = await this.getModuleConfig(Module.name, 'ProcessManager');
    const instance = new Module(config);
    this.managers.set(Module.name, instance);
  }

};
