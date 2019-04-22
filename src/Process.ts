import * as Component    from './Component';

import { Bus }            from './Bus';

import { Module }         from './Module';

import { CommandHandler } from './CommandHandler';
import { Gateway }        from './Gateway';
import { Repository }     from './Repository';
import { Factory }        from './Factory';

import { hostname, userInfo } from 'os';
import { readFile }           from 'fs';
import * as fs                from 'fs';
import { join, dirname }      from 'path';
import merge                  from './merge';

const yaml                    = require('js-yaml');

export interface props extends Component.props {
  root:    string;
  config?: string;
}

export interface children extends Component.children {}

interface Contexts { [context: string]: Context }
interface Context {
  props:    { [module: string]: any };
  children: { [module: string]: Child };
  bus:      Bus;
}

interface ChildManager    { CommandHandler: CommandHandler; Factory: Factory }
interface ChildRepository { Repository: Repository; Factory: Factory }
interface ChildGateway    { Gateway: Gateway; Factory: Factory }

type Child = ChildManager | ChildRepository | ChildGateway;

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
      this.contexts[context] = { props: contexts[context], children: {}, bus: null };
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
        const props = <Component.props>merge(context.props.$all, context.props[name]);
        if (props.name == null) props.name = name;
        this.logger.log('Module %s.%s loading', ctx, name);
        const module = this.getModuleService(ctx, name);
        if (module == null) this.logger.error('Unable to load %s.%s', ctx, name);
        else context.children[name] = module;
      });
    }
  }

  private getModuleService(context: string, name: string): any {
    return [ ['CommandHandler', 'Factory']
           , ['Repository', 'Factory']
           , ['Gateway', 'Factory']
           ].reduce((children, types) => {
      if (children != null) return children;
      return types.reduce((children, type) => {
        const path = join(this.rootpath, context, name, type);
        const part = Process.safeRequire(path);
        if (part == null) return children;
        this.logger.log('Found %s.%s %s', context, name, type);
        return { ...<any>children, [type]: part[type] };
      }, children);
    }, null);
  }

  private loadInstances() {
    for (const context in this.contexts) {
      const ns = this.contexts[context];
      ns.bus = new Bus({ context, name: context, ...ns.props.$Bus }, {});
      for (const name in ns.children) {
        const children = ns.children[name];
        const props    = { context, name, ...ns.props[name], bus: ns.bus };
        const module   = new Module(props, children);
        this.modules.set(context + '.' + name, module);
      }
    }
  }

  /*******************************************/

  public async run() {
    await this.loadContexts();
    await this.loadProps();
    await this.loadModules();
    await this.loadInstances();
    return this.start();
  }

  public async start() {
    this.logger.log('%yellow', '==========  Starting  Services  ==========');
    for (const [name, module] of this.modules)
      if (!await module.start())
        this.logger.error('Unable to start module %s', name);
    for (const name in this.contexts)
      await this.contexts[name].bus.start();
    this.logger.log('%green',  '========== All Services started ==========');
  }

  public async stop() {
    for (const [name, service] of this.modules) await service.stop();
    this.logger.log('%red',    '==========   Services stopped   ==========');
  }

};
