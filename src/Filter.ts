import { Logger }  from './Logger';
import { Command } from './Command';

export type Config = { name: string };

export class Filter {

  constructor(config: Config, facet: any) {
    this.logger = new Logger(config.name + '.Filter', 'yellow');
  }

  public async assert(command: Command<any>) {}

}
