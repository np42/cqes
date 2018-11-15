import { Logger }  from './Logger';
import { Command } from './Command';

export interface Config {
  name: string;
};

export class Filter {

  private logger: Logger;

  constructor(config: Config) {
    this.logger = new Logger(config.name + '.Filter', 'yellow');
  }

  public async assert(command: Command) {}

}
