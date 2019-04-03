import * as Component    from './Component';

import { Module }   from './Module';
import { Manager }  from './Manager';
import { Gateway }  from './Gateway';

import { hostname, userInfo } from 'os';
import { readFile }           from 'fs';
import * as fs                from 'fs';
import { join, dirname }      from 'path';
import * as merge             from 'deepmerge';

const yaml            = require('js-yaml');

const MERGE_OPTIONS   = { arrayMerge: (l: any, r: any, o: any) => r };
const KEYNAMES = new Set( [ 'Component', 'Logger'
                          , 'Module', 'Bus', 'Debouncer', 'Unthrottler', 'Service'
                          , 'CommandBus', 'AMQPCommandBus', 'QueryBus', 'AMQPQueryBus', 'AMQPBus'
                          , 'Manager', 'CommandHandler', 'Factory', 'Repository', 'Reactor'
                          , 'Gateway'
                          ] );

export interface props extends Component.props {
  root:    string;
  config?: string;
}

export interface children extends Component.children {}

export class Process extends Component.Component {
  protected config:      any;
  protected rootpath:    string;
  protected environment: string;
  protected hostname:    string;
  protected procuser:    string;
  protected launcher:    string;
  protected modules:     Map<string, Module>;

  constructor(props: props, children: children) {
    process.on('uncaughtException', (e: any) => this.logger.error('exception: %s', e.stack || e));
    process.on('unhandledRejection', (e: any) => this.logger.error('reject: %s', e.stack || e));
    super(props, children);
    this.config   = {};
    this.rootpath = props.root;
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

  private async loadConfig(): Promise<void> {
    const directory = this.rootpath;
    this.config = await this.getConfig(directory) || {};
  }

  private async getConfig(directory: string): Promise<any> {
    const files = this.getConfigFileList(this.name);
    let config = {};
    for (const file of files) {
      const filepath = join(directory, file);
      const part = await this.configReadYaml(filepath);
      const layer = await this.configInflate(part, dirname(filepath));
      config = merge(config, layer, MERGE_OPTIONS);
    }
    return config;
  }

  private  getConfigFileList(key: string): Array<string> {
    const extension = '.process.yml';
    const list = [key + extension];
    list.push(key + '-env-' + this.environment + extension);
    list.push(key + '-host-' + this.hostname + extension);
    list.push(key + '-user-' + this.procuser + extension);
    list.push(key + '-mode-' + this.launcher + extension);
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

  private async loadModules() {
    for (const name in this.config) {
      if (name[0] === '$') continue ;
      const props = <Component.props>merge(this.config.$all, this.config[name], MERGE_OPTIONS);
      if (props.name == null) props.name = name;
      if (props.type == null) props.type = 'module';
      this.logger.log('Module %s loading', props.name);
      const module = this.getModule(props);
      if (module == null) {
        this.logger.warn('Module %s %red', props.name, 'does not exists');
      } else {
        this.modules.set(name, module);
        this.logger.log('Module %s %green', props.name, 'loaded');
      }
    }
  }

  private getModule(props: Component.props) {
    const name   = props.name;
    const folder = join(this.rootpath, name);
    const exists = ['gateway', 'manager'].reduce((result, type) => {
      if (result) return result;
      const path = name + '.' + type;
      if (fs.existsSync(path)) return type;
    }, null);
    const children = {};
    switch (exists) {
    case null: case undefined: return null;
    case 'manager': Object.assign(children, this.getManagerChildren(name)); break ;
    case 'gateway': Object.assign(children, this.getGatewayChildren(name)); break ;
    }
    return new Module(props, children);
  }

  private getManagerChildren(name: string) {
    const path     = join(this.rootpath, name + '.manager');
    const children = {};
    this.retrieve(children, path, 'Module');
    this.retrieve(children, path, 'Bus', 'Debouncer', 'Unthrottler', 'Manager');
    this.retrieve(children, path, 'CommandHandler', 'Factory', 'Buffer', 'Repository', 'Reactor');
    (<any>children).Service = (<any>children).Manager || Manager;
    return children;
  }

  private getGatewayChildren(name: string) {
    const path     = join(this.rootpath, name + '.gateway');
    const children = {};
    this.retrieve(children, path, 'Module');
    this.retrieve(children, path, 'Bus', 'Debouncer', 'Unthrottler', 'Gateway');
    (<any>children).Service = (<any>children).Gateway || Gateway;
    return children;
  }

  private retrieve(holder: Component.children, path: string, ...elements: Array<string>) {
    elements.forEach((element: string) => {
      const ns = this.safeRequire(join(path, element + '.js'));
      if (ns == null) return ;
      holder[element] = ns[element];
    });
  }

  private safeRequire(path: string) {
    try {
      const module = require(path);
      return module;
    } catch (e) {
      if (e.code != 'MODULE_NOT_FOUND') throw e;
      if (!~e.toString().indexOf(path)) throw e;
      return null;
    }
  }

  /*******************************************/

  public async run() {
    await this.loadConfig();
    await this.loadModules();
    this.logger.log('%yellow', '============ Services initialized ============');
    return this.start();
  }

  public async start() {
    for (const [name, module] of this.modules)
      if (!await module.start())
        this.logger.error('Unable to start module %s', name);
    this.logger.log('%green', '============   Services started   ============');
  }

  public async stop() {
    for (const [name, service] of this.modules) await service.stop();
    this.logger.log('%red', '============   Services stopped   ============');
  }

};
