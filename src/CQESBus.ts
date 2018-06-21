import Logger                           from './Logger';

import { Handler as CommandHandler }    from './CommandBus';
import { Handler as EventHandler }      from './EventBus';

import { InCommand, OutCommand }        from './Command';
import { InQuery, OutQuery }            from './Query';
import { InEvent, OutEvent }            from './Event';

import { AMQPCommandBus as CommandBus } from './AMQPCommandBus';
import { AMQPQueryBus   as QueryBus }   from './AMQPQueryBus';
import { ESEventBus     as EventBus }   from './ESEventBus';
import { ESEventBus     as StateBus }   from './ESEventBus';

import { v1 as uuidv1 }                 from 'uuid';
import * as URL                         from 'url';

export class Bus {

  private config:     any;
  private logger:     any;
  private cbus:       Map<string, any>;
  private qbus:       any;
  private ebus:       any;
  private sbus:       any;

  constructor(config: any = {}, name: any = null) {
    this.config        = config;
    const ebname       = { toString: () => name + ':Bus' };
    this.logger        = new Logger(ebname, 'red');
    //--
    this.initCommands(config.Commands);
    this.initQueries(config.Queries);
    this.initEvents(config.Events);
    this.initStates(config.States);
  }

  // Commands
  private initCommands(config: any) {
    return new CommandBus(config);
  }

  public async request(command: OutCommand<any>) {
    
  }

  public listen(topic: string, handler: CommandHandler<InCommand<any>>) {
    
  }

  // Queries
  private initQueries(config: any) {

  }

  public server(endpoint: string, handler: CommandHandler<InQuery<any>>) {

  }

  // Events
  private initEvents(config: any) {

  }

  public async publish(stream: string, position: any, events: Array<OutEvent<any>>) {

  }

  public read(streamId: string, from: any) {

  }

  public subscribe(streamId: string, from: any) {

  }

  // States
  private initStates(config: any) {

  }

  public load(processId: string) {

  }

  public save(processId: string, versions: Map<string, number>, data: any) {

  }

}
