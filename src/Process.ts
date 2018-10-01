import { hostname } from 'os';
import { readFile } from 'fs';
import { join }     from 'path';

import { Logger }   from './Logger';

const yaml       = require('js-yaml');
const extendify  = require('extendify');
const CLArgs     = require('command-line-args');

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

  private async loadConfig(): Promise<void> {
    const directory = join(this.rootpath, 'config');
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
      const service = String(group.services[i]);
      const nodeName = service;
      this.logger.log('Loading Custom Service: %s', nodeName);
      const path = join(this.rootpath, 'dist/src', nodeName, nodeName + '.js');
      const node = require(path).default;
      this.services.set(service, node);
    }
  }

  public async run() {
    await this.loadConfig();
    await this.loadServices();
    await this.start();
  }

  public async start() {
    for (const [name, service] of this.services) {
      const options = (this.config.Service || {})[name] || {};
      service.start(this.config.Bus, options);
    }
  }

};
