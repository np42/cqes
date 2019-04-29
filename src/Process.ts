import * as Component    from './Component';

import { Bus }            from './Bus';

import { Module }         from './Module';
import * as Interface     from './Interface';

import { CommandHandler } from './CommandHandler';
import { Gateway }        from './Gateway';
import { Repository }     from './Repository';
import { Factory }        from './Factory';

import { hostname, userInfo }      from 'os';
import { readFile }                from 'fs';
import * as fs                     from 'fs';
import { join, dirname, basename } from 'path';
import merge                       from './merge';

const yaml                    = require('js-yaml');

export interface props extends Component.props {
  root:    string;
  config?: string;
}

export interface children extends Component.children {}

interface Contexts { [context: string]: Context }
interface Context {
  props:        { [module: string]: any };
  children:     { [module: string]: Child };
  dependencies: { [module: string]: { [name: string]: IFace } };
  bus:          Bus;
}

interface ChildManager    { type: 'CommandHandler', CommandHandler: CommandHandler; Factory?: Factory }
interface ChildRepository { type: 'Repository', Repository: Repository; Factory?: Factory }
interface ChildGateway    { type: 'Gateway', Gateway: Gateway; Factory?: Factory }

type Child = ChildManager | ChildRepository | ChildGateway;
interface IFace {
  context: string;
  name:    string;
  iface:   { [iface: string]: { new (props: Interface.props): Interface.Interface } };
}

export class Process extends Component.Component {
  protected contexts:    Contexts;
  protected modules:     Map<string, Module>;
  protected rootpath:    string;
  protected environment: string;
  protected hostname:    string;
  protected procuser:    string;
  protected launcher:    string;

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

  constructor(props: props, children: children) {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
    super(props, children);
    this.rootpath = props.root;
    this.contexts = {};
    this.modules  = new Map();
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

  private async loadContexts(): Promise<void> {
    const filename  = 'cqes.yml';
    const directory = this.rootpath;
    const filepath  = join(directory, filename);
    const processes = await this.readYaml(filepath);
    const contexts  = processes[this.name] || {};
    for (const context in contexts)
      this.contexts[context] = { props: contexts[context], children: {}, dependencies: {}, bus: null };
  }

  private async loadProps(): Promise<void> {
    for (const context in this.contexts) {
      const directory = join(this.rootpath, context);
      const props = await this.getProps(directory, context) || {};
      this.contexts[context].props = merge(props, this.contexts[context].props);
    }
  }

  private async getProps(directory: string, name: string): Promise<any> {
    const files = this.getPropsFileList();
    let config = {};
    for (const file of files) {
      const filepath = join(directory, file);
      const layer = await this.readYaml(filepath);
      config = merge(config, layer);
    }
    return config;
  }

  private  getPropsFileList(): Array<string> {
    const extension = '.yml';
    const list = ['Process' + extension];
    list.push('Process.env-' + this.environment + extension);
    list.push('Process.host-' + this.hostname + extension);
    list.push('Process.user-' + this.procuser + extension);
    list.push('Process.mode-' + this.launcher + extension);
    return list;
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

  /******************************/

  private async loadModules() {
    for (const ctx in this.contexts) {
      const context = this.contexts[ctx];
      const modules = Object.keys(context.props).filter(n => /^[A-Z0-9]/.test(n))
      modules.forEach((name: string) => {
        const config = context.props[name];
        const props = <Component.props>merge(context.props.$all, context.props[name]);
        if (props.name == null) props.name = name;
        this.logger.log('Module %s.%s loading', ctx, name);
        const module = this.getModuleService(ctx, name);
        if (module == null) return this.logger.error('Unable to load %s.%s', ctx, name);
        for (const key in config)
          if (key[0] === '_') {
            const depname = key.substr(1);
            const dependency = this.getDependency(config[key].context, config[key].name);
            config[key].iface = dependency;
            if (context.dependencies[name] == null) context.dependencies[name] = {};
            context.dependencies[name][depname] = config[key];
          }
        context.children[name] = module;
      });
    }
  }

  private getModuleService(context: string, name: string): any {
    return [ [['CommandHandler', 'Factory'], ['commands', 'state']]
           , [['Repository', 'Factory'], ['queries', 'replies', 'state']]
           , [['Gateway', 'Factory'], ['state']]
           ].reduce((children, types) => {
      if (children != null) return children;
      const result = types[0].reduce((children, type, index) => {
        if (index > 0 && children == null) return null;
        const path = join(this.rootpath, context, name, type);
        const part = Process.safeRequire(path);
        if (part == null) return children;
        if (part[name + type] == null) {
          this.logger.warn('Missing %s in %s', name + type, path);
          return children;
        }
        if (index === 0) return { type, [type]: part[name + type] };
        else return { ...<any>children, [type]: part[name + type] };
      }, null);
      if (result == null) return result;
      return ['../events'].concat(types[1]).reduce((ios, io) => {
        const path = join(this.rootpath, context, name, io);
        const types = Process.safeRequire(path);
        if (types) ios[basename(io)] = types;
        return ios;
      }, result);
    }, null);
  }

  private getDependency(context: string, name: string) {
    const path = join(this.rootpath, context, name);
    const module = Process.safeRequire(path);
    return module && module[name + 'Index'] || null;
  }

  private createInstances() {
    for (const context in this.contexts) {
      const ns = this.contexts[context];
      ns.bus = new Bus({ context, name: context, ...ns.props.$Bus }, {});
      for (const name in ns.children) {
        const children = ns.children[name];
        const props    = { context, name, ...ns.props[name], bus: ns.bus };
        const module   = new Module(props, <any>children);
        this.modules.set(context + '.' + name, module);
      }
    }
  }

  private bindDependencies() {
    for (const context in this.contexts) {
      const ns = this.contexts[context];
      for (const module in ns.dependencies) {
        const dependencies = ns.dependencies[module];
        for (const dependency in dependencies) {
          const depConfig = dependencies[dependency];
          const depContext = this.contexts[depConfig.context];
          if (depConfig.iface == null) {
            this.logger.error('Missing iface %s.%s :: %s', context, module, dependency);
            continue ;
          }
          if (depContext == null || depContext.bus == null) {
            this.logger.error('Missing bus %s.%s :: %s', context, module, dependency);
          } else {
            const props = { bus: depContext.bus, name: depConfig.name, context: depConfig.context };
            const dep = new (<any>depConfig.iface)(props);
            const children = ns.children[module];
            const node = children[children.type];
            node[dependency] = dep;
          }
        }
      }
    }
  }

  /*******************************************/

  public async run() {
    await this.loadContexts();
    await this.loadProps();
    await this.loadModules();
    this.createInstances();
    this.bindDependencies();
    return this.start();
  }

  public async start() {
    this.logger.log('%yellow', '==========  Starting  Services  ==========');
    const promises = <Array<Promise<string>>>[];
    this.modules.forEach((module, name) => {
      this.logger.log('Starting %s', name);
      return new Promise(resolve => module.start().then(started => resolve(started ? null : name)));
    });
    await Promise.all(promises).then(result => result.forEach(failed => {
      if (failed) this.logger.error('Unable to start module %s', failed);
    }));
    await Promise.all(Object.keys(this.contexts).map(name => {
      return this.contexts[name].bus.start();
    }));
    this.logger.log('%green',  '========== All Services started ==========');
  }

  public async stop() {
    for (const [name, service] of this.modules) await service.stop();
    this.logger.log('%red',    '==========   Services stopped   ==========');
  }

};
