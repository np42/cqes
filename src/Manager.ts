import { CQESBus }      from './CQESBus'
import { Aggregate }    from './Aggregate'
import { State }        from './State'
import { OutEvent }     from './Event'

type Options              = { Bus: any };
type ManagerAggregate<A>  = new (): Aggregate<A>;
type CommandTyper         = new (data: any): State<any>;
type CommandExecutor<A>   = (Aggregate<A>, InCommand<any>) => Array<OutEvent<any>>;
type CommandTranslator    = (InCommand<any>) => Array<OutCommand<any>>;
type CommandHandler<A>    = { type: 'Handler', handler: CommandExecutor<A> }
                          | { type: 'Translator', translator: CommandTranslator };

export class Manager<A> {
  private bus:         CQESBus;
  private aggregate:   Aggregate<A>;
  private handlers:    Map<string, CommandHandler<A>>;
  public  commands:    Map<string, CommandTyper>;

  constructor(config: Options, AggregateClass: ManagerAggregate) {
    this.bus         = new CQESBus(config.Bus);
    this.commands    = new Map()
    this.aggregate   = new AggregateClass();
    this.handlers    = new Map()
    this.translators = new Map()
  }

  init() {
    this.listen(this.name);
  }

  // register command typer
  watch(name: string, typer: CommandTyper) {
    this.commands.set(name, typer)
    return this
  }

  // register command handler
  handle(name: string, handler: CommandExecutor<A>) {
    this.handlers.set(name, { type: 'Handler', handler })
    return this
  }

  // register command translator
  translate(name: string, translator: CommandTranslator) {
    this.handlers.set(name, { type: 'Translator', translator });
    return this;
  }

}
