import { v1 as uuidv1 }         from 'uuid';
import * as URL                 from 'url';
import Logger                   from 'bhiv/Logger';

type credentials  = { username: string, password: string };

// Commands
type configCommand = { origin: string, credentials: credentials };
type queryHandler  = (request: request, response: response) => void

// Queries
type configQuery   = { listen: string, port: number }
type responseType  = string;
type request       = { endpoint: string, params: Array<string>, payload: any };
type response      = { write: (chunk: any) => void, end: (chunk: any) => void }

// Events
type configEvent   = { origin: string, credentials: credentials };
type eventPosition = number;

// States
type configState   = { origin: string, credentials: credentials };

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
  private initCommands(config: configCommand) {
    debugger;
    let url = config.origin;
    if (config.credentials != null)
      url = URL.format({ ...URL.parse(url), ...config.credentials });
    console.log(url);
  }

  public async request(commands: Array<Command<any>>) {
    this.cbus.next(Rx.Observable.from(commands));
  }

  public listen(topicId: string) {
    
  }

  // Queries
  private initQueries(config: configQuery) {

  }

  public server(endpoint: string, handler: queryHandler, type: responseType) {

  }

  // Events
  private initEvents(config: configEvent) {
  }

  public async publish(streamId: string, events: Array<Event<any>>) {

  }

  public read(streamId: string, from: position) {

  }

  public subscribe(streamId: string, from: position) {

  }

  // States
  private initState(config: configState) {

  }

  public load(processId: string) {

  }

  public save(processId: string, versions: Map<string, number>, data: any) {

  }

}
